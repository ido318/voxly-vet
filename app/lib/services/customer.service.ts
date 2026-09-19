import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateCustomerInput,
  Customer,
  CustomerListFilters,
  UpdateCustomerInput,
} from "@/types/domain/customer";

export class CustomerService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly petRepository: PetRepository,
    private readonly auditService: AuditService,
  ) {}

  async listCustomers(
    actor: ServiceActor,
    filters: Omit<CustomerListFilters, "clinicIds"> & { clinicIds?: string[] },
  ): Promise<Result<Customer[]>> {
    return this.customerRepository.list({
      ...filters,
      clinicIds: filters.clinicIds ?? actor.clinicIds,
    });
  }

  async getCustomerById(actor: ServiceActor, customerId: string): Promise<Result<Customer>> {
    const result = await this.customerRepository.findById(customerId);
    if (!result.ok) return result;
    if (!result.value) return err(AppError.notFound("Customer not found"));
    if (!actor.clinicIds.includes(result.value.clinicId)) {
      return err(AppError.forbidden("Customer is outside actor clinics"));
    }
    return ok(result.value);
  }

  async createCustomer(actor: ServiceActor, input: CreateCustomerInput): Promise<Result<Customer>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create customer in this clinic"));
    }

    const duplicates = await this.customerRepository.findPotentialDuplicates(input.clinicId, {
      phone: input.phone,
      email: input.email,
    });
    if (!duplicates.ok) return err(duplicates.error);
    if (duplicates.value.length > 0) {
      return err(
        AppError.conflict("Customer duplicate detected", {
          duplicates: duplicates.value,
        }),
      );
    }

    const createdResult = await this.customerRepository.insert(input);
    if (!createdResult.ok) return createdResult;

    await this.auditService.logAction({
      clinicId: createdResult.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "customer.create",
      entityType: "customer",
      entityId: createdResult.value.id,
      afterPayload: createdResult.value,
    });

    return createdResult;
  }

  async updateCustomer(
    actor: ServiceActor,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<Result<Customer>> {
    const existing = await this.getCustomerById(actor, customerId);
    if (!existing.ok) return existing;

    if (input.clinicId && input.clinicId !== existing.value.clinicId) {
      return err(AppError.validation("Changing customer clinic is not allowed"));
    }

    const updatedResult = await this.customerRepository.update(customerId, {
      ...input,
      clinicId: existing.value.clinicId,
    });
    if (!updatedResult.ok) return updatedResult;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "customer.update",
      entityType: "customer",
      entityId: existing.value.id,
      beforePayload: existing.value,
      afterPayload: updatedResult.value,
    });

    return updatedResult;
  }

  async softDeleteCustomer(actor: ServiceActor, customerId: string): Promise<Result<void>> {
    const existing = await this.getCustomerById(actor, customerId);
    if (!existing.ok) return err(existing.error);

    const petsResult = await this.petRepository.list({
      clinicIds: [existing.value.clinicId],
      customerId: existing.value.id,
    });
    if (!petsResult.ok) return err(petsResult.error);
    if (petsResult.value.length > 0) {
      return err(
        AppError.conflict("Cannot delete customer with active pets", {
          petCount: petsResult.value.length,
        }),
      );
    }

    const deletedResult = await this.customerRepository.softDelete(customerId);
    if (!deletedResult.ok) return deletedResult;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "customer.delete",
      entityType: "customer",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return deletedResult;
  }
}
