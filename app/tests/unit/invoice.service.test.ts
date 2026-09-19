import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { computeInvoiceTotal, InvoiceService } from "@/lib/services/invoice.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Invoice } from "@/types/domain/invoice";

describe("computeInvoiceTotal", () => {
  it("sums quantity * unitPrice across all line items", () => {
    const total = computeInvoiceTotal([
      { description: "בדיקה כללית", quantity: 1, unitPrice: 180 },
      { description: "חיסון שנתי", quantity: 1, unitPrice: 120 },
      { description: "זריקות נוגדות פרעושים", quantity: 3, unitPrice: 50 },
    ]);

    expect(total).toBe(450);
  });

  it("rounds to 2 decimal places to avoid floating-point drift", () => {
    const total = computeInvoiceTotal([
      { description: "טיפול", quantity: 3, unitPrice: 33.33 },
    ]);

    expect(total).toBe(99.99);
  });

  it("returns 0 for an empty item list", () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });
});

const { sendSmsMock } = vi.hoisted(() => ({ sendSmsMock: vi.fn() }));
vi.mock("@/lib/integrations/twilio/sms", () => ({
  sendSms: sendSmsMock,
}));

const CLINIC = "clinic-1";
const actor: ServiceActor = {
  userId: "user-1",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "owner" }],
};

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    clinicId: CLINIC,
    customerId: "cust-1",
    customerName: "דנה",
    petId: null,
    petName: null,
    invoiceNumber: "INV-2026-001",
    status: "sent",
    issuedAt: "2026-09-01T00:00:00.000Z",
    items: [{ description: "בדיקה כללית", quantity: 1, unitPrice: 150 }],
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
    ...overrides,
  };
}

function buildInvoiceService(
  invoice: Invoice | null,
  customer: { id: string; fullName: string; phone: string | null } | null = {
    id: "cust-1",
    fullName: "דנה",
    phone: "0501234567",
  },
) {
  const repository = {
    findById: vi.fn(async () => ok(invoice)),
    claimPaymentLinkSend: vi.fn(async () =>
      ok(invoice ? { ...invoice, paymentLinkSentAt: "claimed" } : null),
    ),
    releasePaymentLinkClaim: vi.fn(async () => ok(undefined)),
    attachPaymentLink: vi.fn(async () =>
      ok({ ...(invoice as Invoice), paymentLinkUrl: "https://pay.example/doc-1", paymentLinkSentAt: "now" }),
    ),
  };
  const customerRepository = { findById: vi.fn(async () => ok(customer)) };
  const greenInvoiceService = {
    createPaymentDocument: vi.fn(async () => ({ documentId: "doc-1", paymentUrl: "https://pay.example/doc-1" })),
  };
  const auditService = { logAction: vi.fn(async () => ok({})) };

  const service = new InvoiceService(
    repository as never,
    auditService as never,
    customerRepository as never,
    greenInvoiceService as never,
  );
  return { service, repository, customerRepository, greenInvoiceService, auditService };
}

beforeEach(() => {
  sendSmsMock.mockReset();
  sendSmsMock.mockResolvedValue({ sid: "SM123" });
});

describe("InvoiceService.sendPaymentLink", () => {
  it("creates a Green Invoice document, saves the link, and texts the customer", async () => {
    const { service, repository, greenInvoiceService, auditService } = buildInvoiceService(makeInvoice());

    const result = await service.sendPaymentLink(actor, "invoice-1");

    expect(result.ok).toBe(true);
    expect(repository.claimPaymentLinkSend).toHaveBeenCalledWith("invoice-1");
    expect(greenInvoiceService.createPaymentDocument).toHaveBeenCalledOnce();
    expect(repository.attachPaymentLink).toHaveBeenCalledWith("invoice-1", {
      paymentLinkUrl: "https://pay.example/doc-1",
      greenInvoiceDocumentId: "doc-1",
    });
    expect(sendSmsMock).toHaveBeenCalledOnce();
    const [to, body] = sendSmsMock.mock.calls[0]!;
    expect(to).toBe("0501234567");
    expect(body).toContain("https://pay.example/doc-1");
    expect(auditService.logAction).toHaveBeenCalledOnce();
  });

  it("does not persist a payment link when the SMS send fails", async () => {
    const { service, repository } = buildInvoiceService(makeInvoice());
    sendSmsMock.mockRejectedValueOnce(new Error("twilio down"));

    const result = await service.sendPaymentLink(actor, "invoice-1");

    expect(result.ok).toBe(false);
    expect(repository.attachPaymentLink).not.toHaveBeenCalled();
    expect(repository.releasePaymentLinkClaim).toHaveBeenCalledWith("invoice-1");
  });

  it("rejects when the invoice is not yet issued (status !== sent)", async () => {
    const { service, greenInvoiceService } = buildInvoiceService(makeInvoice({ status: "draft" }));

    const result = await service.sendPaymentLink(actor, "invoice-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(greenInvoiceService.createPaymentDocument).not.toHaveBeenCalled();
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("rejects when the customer has no phone number", async () => {
    const { service, greenInvoiceService } = buildInvoiceService(makeInvoice(), {
      id: "cust-1",
      fullName: "דנה",
      phone: null,
    });

    const result = await service.sendPaymentLink(actor, "invoice-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(greenInvoiceService.createPaymentDocument).not.toHaveBeenCalled();
  });

  it("forbids a non owner/admin actor from sending a payment link", async () => {
    const staffActor: ServiceActor = {
      ...actor,
      memberships: [{ clinicId: CLINIC, role: "veterinarian" }],
    };
    const { service, greenInvoiceService } = buildInvoiceService(makeInvoice());

    const result = await service.sendPaymentLink(staffActor, "invoice-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(greenInvoiceService.createPaymentDocument).not.toHaveBeenCalled();
  });

  it("rejects a second send when paymentLinkSentAt is already set", async () => {
    const { service, greenInvoiceService, repository } = buildInvoiceService(
      makeInvoice({ paymentLinkSentAt: "2026-09-01T10:00:00.000Z" }),
    );

    const result = await service.sendPaymentLink(actor, "invoice-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
    expect(repository.claimPaymentLinkSend).not.toHaveBeenCalled();
    expect(greenInvoiceService.createPaymentDocument).not.toHaveBeenCalled();
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
});
