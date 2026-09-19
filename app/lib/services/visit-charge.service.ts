import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { InvoiceRepository } from "@/lib/repositories/invoice.repository";
import type { VisitChargeRepository } from "@/lib/repositories/visit-charge.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { CreateVisitChargeInput, VisitCharge } from "@/types/domain/visit-charge";
import type { Invoice } from "@/types/domain/invoice";
import type { Visit } from "@/types/domain/visit";

function canManageInvoices(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class VisitChargeService {
  constructor(
    private readonly repository: VisitChargeRepository,
    private readonly visitRepository: VisitRepository,
    private readonly invoiceRepository: InvoiceRepository,
  ) {}

  async listForVisit(actor: ServiceActor, visitId: string): Promise<Result<VisitCharge[]>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    return this.repository.listByVisit(visitId);
  }

  async createForVisit(
    actor: ServiceActor,
    visitId: string,
    input: CreateVisitChargeInput,
  ): Promise<Result<VisitCharge>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    return this.repository.create({
      ...input,
      clinicId: visit.value.clinicId,
      visitId,
      customerId: visit.value.customerId,
      petId: visit.value.petId,
      createdByUserId: actor.userId,
    });
  }

  async reviewCharge(actor: ServiceActor, chargeId: string): Promise<Result<VisitCharge>> {
    return this.repository.review(chargeId, actor.userId, actor.clinicIds);
  }

  async createInvoiceFromVisit(
    actor: ServiceActor,
    visitId: string,
    input: { notes?: string | null },
  ): Promise<Result<Invoice>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    if (!canManageInvoices(actor, visit.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage invoices"));
    }

    const created = await this.repository.createInvoiceFromVisit({
      visitId,
      notes: input.notes ?? null,
      createdByUserId: actor.userId,
    });
    if (!created.ok) return err(created.error);

    const invoice = await this.invoiceRepository.findById(created.value.id);
    if (!invoice.ok) return invoice;
    if (!invoice.value) {
      return err(AppError.externalProvider("Invoice created but could not be re-fetched", created.value));
    }
    return ok(invoice.value);
  }

  private async loadVisit(actor: ServiceActor, visitId: string): Promise<Result<Visit>> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit.ok) return visit;
    if (!visit.value) return err(AppError.notFound("Visit not found"));
    if (!actor.clinicIds.includes(visit.value.clinicId)) {
      return err(AppError.forbidden("Visit outside actor clinics"));
    }
    return ok(visit.value);
  }
}
