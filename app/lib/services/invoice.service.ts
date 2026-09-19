import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { sendSms } from "@/lib/integrations/twilio/sms";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { InvoiceRepository } from "@/lib/repositories/invoice.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { GreenInvoiceService } from "@/lib/services/green-invoice.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateInvoiceInput,
  Invoice,
  InvoiceLineItem,
  InvoiceListFilters,
  InvoiceStatus,
} from "@/types/domain/invoice";

function canManageInvoices(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

// Never trust a client-supplied total - always derive it from the line items
// server-side, so an invoice's stored total can never drift from what it itemizes.
export function computeInvoiceTotal(items: InvoiceLineItem[]): number {
  const rawTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return Math.round(rawTotal * 100) / 100;
}

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "void"],
  paid: [],
  void: [],
};

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository,
    private readonly auditService: AuditService,
    private readonly customerRepository?: CustomerRepository,
    private readonly greenInvoiceService?: GreenInvoiceService,
  ) {}

  async listInvoices(
    actor: ServiceActor,
    input: Omit<InvoiceListFilters, "clinicIds">,
  ): Promise<Result<Invoice[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds, ...input });
  }

  async getInvoiceById(actor: ServiceActor, invoiceId: string): Promise<Result<Invoice>> {
    const existing = await this.repository.findById(invoiceId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Invoice not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Invoice outside actor clinics"));
    }
    return ok(existing.value);
  }

  async createInvoice(actor: ServiceActor, input: CreateInvoiceInput): Promise<Result<Invoice>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create invoice for requested clinic"));
    }
    if (!canManageInvoices(actor, input.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage invoices"));
    }

    const total = computeInvoiceTotal(input.items);

    const result = await this.repository.create({
      clinicId: input.clinicId,
      customerId: input.customerId,
      petId: input.petId ?? null,
      items: input.items,
      total,
      notes: input.notes ?? null,
      createdByUserId: actor.userId,
    });

    if (result.ok) {
      await this.auditService.logAction({
        clinicId: input.clinicId,
        actorType: "user",
        actorId: actor.userId,
        action: "invoice.create",
        entityType: "invoice",
        entityId: result.value.id,
        afterPayload: result.value,
      });
    }

    return result;
  }

  async updateStatus(
    actor: ServiceActor,
    invoiceId: string,
    expectedVersion: number,
    status: InvoiceStatus,
  ): Promise<Result<Invoice>> {
    const existing = await this.getInvoiceById(actor, invoiceId);
    if (!existing.ok) return existing;
    if (!canManageInvoices(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage invoices"));
    }
    if (!VALID_TRANSITIONS[existing.value.status].includes(status)) {
      return err(
        AppError.validation(
          `Cannot change invoice status from ${existing.value.status} to ${status}`,
        ),
      );
    }

    return this.repository.updateStatusVersioned(invoiceId, expectedVersion, status);
  }

  // Creates a Green Invoice payment document for an issued invoice and texts
  // the customer the payment link. Manual, dashboard-triggered action only —
  // no live-call or automatic trigger (see CLAUDE.md payments decision log).
  async sendPaymentLink(actor: ServiceActor, invoiceId: string): Promise<Result<Invoice>> {
    if (!this.customerRepository || !this.greenInvoiceService) {
      return err(AppError.serviceUnavailable("Payment link sending is not configured"));
    }

    const existing = await this.getInvoiceById(actor, invoiceId);
    if (!existing.ok) return existing;
    const invoice = existing.value;

    if (!canManageInvoices(actor, invoice.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage invoices"));
    }
    if (invoice.status !== "sent") {
      return err(
        AppError.validation("ניתן לשלוח קישור תשלום רק לחשבונית שהונפקה (סטטוס 'נשלחה')"),
      );
    }
    if (invoice.paymentLinkSentAt) {
      return err(AppError.conflict("קישור תשלום כבר נשלח לחשבונית זו"));
    }

    const customerResult = await this.customerRepository.findById(invoice.customerId);
    if (!customerResult.ok) return customerResult;
    const customer = customerResult.value;
    if (!customer) return err(AppError.notFound("הלקוח לא נמצא"));
    if (!customer.phone) {
      return err(AppError.validation("ללקוח אין מספר טלפון לשליחת קישור התשלום"));
    }

    const claimed = await this.repository.claimPaymentLinkSend(invoiceId);
    if (!claimed.ok) return claimed;
    if (!claimed.value) {
      return err(AppError.conflict("קישור תשלום כבר נשלח לחשבונית זו"));
    }

    let document: { documentId: string; paymentUrl: string };
    try {
      document = await this.greenInvoiceService.createPaymentDocument(
        customer,
        invoice.items,
        invoice.notes,
      );
    } catch (error) {
      await this.repository.releasePaymentLinkClaim(invoiceId);
      return err(AppError.externalProvider("יצירת מסמך התשלום נכשלה", error));
    }

    try {
      await sendSms(
        customer.phone,
        `שלום ${customer.fullName}, מצורף קישור לתשלום עבור חשבונית ${invoice.invoiceNumber} על סך ${invoice.total} ₪:\n${document.paymentUrl}`,
      );
    } catch (error) {
      await this.repository.releasePaymentLinkClaim(invoiceId);
      return err(AppError.externalProvider("שליחת קישור התשלום נכשלה", error));
    }

    const updated = await this.repository.attachPaymentLink(invoiceId, {
      paymentLinkUrl: document.paymentUrl,
      greenInvoiceDocumentId: document.documentId,
    });
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId: invoice.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "invoice.payment_link_sent",
      entityType: "invoice",
      entityId: invoiceId,
      afterPayload: updated.value,
    });

    return updated;
  }
}
