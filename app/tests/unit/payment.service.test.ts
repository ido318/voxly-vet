import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { PaymentService } from "@/lib/services/payment.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Invoice } from "@/types/domain/invoice";

const CLINIC = "clinic-1";
const OTHER = "clinic-2";

const actor: ServiceActor = {
  userId: "user-1",
  clinicIds: [CLINIC, OTHER],
  defaultClinicId: CLINIC,
  memberships: [
    { clinicId: CLINIC, role: "owner" },
    { clinicId: OTHER, role: "owner" },
  ],
};

function invoice(clinicId: string): Invoice {
  return {
    id: "invoice-1",
    clinicId,
    customerId: "cust-1",
    customerName: "דנה",
    petId: null,
    petName: null,
    invoiceNumber: "INV-2026-001",
    status: "sent",
    issuedAt: "2026-09-01T00:00:00.000Z",
    items: [{ description: "בדיקה", quantity: 1, unitPrice: 150 }],
    total: 150,
    notes: null,
    paymentLinkUrl: null,
    greenInvoiceDocumentId: null,
    paymentLinkSentAt: null,
    createdByUserId: "user-1",
    version: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("PaymentService.recordPayment", () => {
  it("derives clinicId from the invoice, ignoring a mismatched client clinicId", async () => {
    const invoiceRepository = { findById: vi.fn(async () => ok(invoice(CLINIC))) };
    const paymentRepository = { record: vi.fn(async () => ok({ id: "pay-1" })) };
    const service = new PaymentService(paymentRepository as never, invoiceRepository as never);

    const result = await service.recordPayment(actor, {
      clinicId: OTHER,
      invoiceId: "invoice-1",
      amount: 150,
      method: "cash",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(paymentRepository.record).not.toHaveBeenCalled();
  });

  it("records against the invoice clinic after loading the invoice server-side", async () => {
    const invoiceRepository = { findById: vi.fn(async () => ok(invoice(CLINIC))) };
    const paymentRepository = { record: vi.fn(async () => ok({ id: "pay-1" })) };
    const service = new PaymentService(paymentRepository as never, invoiceRepository as never);

    const result = await service.recordPayment(actor, {
      invoiceId: "invoice-1",
      amount: 150,
      method: "cash",
    });

    expect(result.ok).toBe(true);
    expect(paymentRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: CLINIC,
        invoiceId: "invoice-1",
        recordedByUserId: "user-1",
      }),
    );
  });
});
