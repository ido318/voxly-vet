import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { CreatePetInput, Pet, UpdatePetInput } from "@/types/domain/pet";

export class PetService {
  constructor(
    private readonly petRepository: PetRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly auditService: AuditService,
    private readonly medicalRecordService?: Pick<MedicalRecordService, "ensureRecordForPet">,
  ) {}

  async listPets(
    actor: ServiceActor,
    customerId?: string,
    query?: string,
  ): Promise<Result<Pet[]>> {
    return this.petRepository.list({
      clinicIds: actor.clinicIds,
      customerId,
      query,
    });
  }

  async getPetById(actor: ServiceActor, petId: string): Promise<Result<Pet>> {
    const result = await this.petRepository.findById(petId);
    if (!result.ok) return result;
    if (!result.value) return err(AppError.notFound("Pet not found"));
    if (!actor.clinicIds.includes(result.value.clinicId)) {
      return err(AppError.forbidden("Pet is outside actor clinics"));
    }
    return ok(result.value);
  }

  async createPet(actor: ServiceActor, input: CreatePetInput): Promise<Result<Pet>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create pet in this clinic"));
    }

    const customerResult = await this.customerRepository.findById(input.customerId);
    if (!customerResult.ok) return err(customerResult.error);
    if (!customerResult.value) return err(AppError.notFound("Customer not found"));

    // Service-layer safety: pet and customer must be in the same clinic.
    if (customerResult.value.clinicId !== input.clinicId) {
      return err(
        AppError.validation("Pet clinic must match customer clinic", {
          customerClinicId: customerResult.value.clinicId,
          petClinicId: input.clinicId,
        }),
      );
    }

    const createdResult = await this.petRepository.insert(input);
    if (!createdResult.ok) return createdResult;

    if (this.medicalRecordService) {
      const record = await this.medicalRecordService.ensureRecordForPet(actor, {
        clinicId: createdResult.value.clinicId,
        petId: createdResult.value.id,
      });
      if (!record.ok) return err(record.error);
    }

    await this.auditService.logAction({
      clinicId: createdResult.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "pet.create",
      entityType: "pet",
      entityId: createdResult.value.id,
      afterPayload: createdResult.value,
      metadata: { customerId: createdResult.value.customerId },
    });

    return createdResult;
  }

  async updatePet(actor: ServiceActor, petId: string, input: UpdatePetInput): Promise<Result<Pet>> {
    const existing = await this.getPetById(actor, petId);
    if (!existing.ok) return existing;

    const updated = await this.petRepository.update(petId, input);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "pet.update",
      entityType: "pet",
      entityId: existing.value.id,
      beforePayload: existing.value,
      afterPayload: updated.value,
    });

    return updated;
  }

  async softDeletePet(actor: ServiceActor, petId: string): Promise<Result<void>> {
    const existing = await this.getPetById(actor, petId);
    if (!existing.ok) return err(existing.error);

    const deleted = await this.petRepository.softDelete(petId);
    if (!deleted.ok) return deleted;

    await this.auditService.logAction({
      clinicId: existing.value.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "pet.delete",
      entityType: "pet",
      entityId: existing.value.id,
      beforePayload: existing.value,
    });

    return deleted;
  }
}
