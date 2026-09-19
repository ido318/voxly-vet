import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { InventoryService } from "@/lib/services/inventory.service";
import { VisitChargeService } from "@/lib/services/visit-charge.service";
import type { ServiceActor } from "@/lib/services/service-context";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const actor: ServiceActor = {
  userId: "owner1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "owner" }],
};

const visit = {
  id: "visit1",
  clinicId: "clinic1",
  customerId: "customer1",
  petId: "pet1",
};

describe("Phase 10 inventory and billing", () => {
  it("adjusts inventory through the service with auditable transaction metadata", async () => {
    const repository = {
      adjust: vi.fn().mockResolvedValue(ok({ id: "item1", quantityOnHand: 4 })),
    };
    const service = new InventoryService(repository as never);

    const result = await service.adjustItem(actor, "item1", {
      clinicId: "clinic1",
      quantityDelta: -1,
      reason: "חיסון בביקור",
      transactionType: "usage",
      sourceType: "visit",
      sourceId: "visit1",
    });

    expect(result.ok).toBe(true);
    expect(repository.adjust).toHaveBeenCalledWith("item1", expect.objectContaining({
      quantityDelta: -1,
      sourceType: "visit",
      sourceId: "visit1",
      createdByUserId: "owner1",
    }));
  });

  it("requires reviewed charges before creating invoice from visit", async () => {
    const chargeRepository = {
      createInvoiceFromVisit: vi.fn().mockResolvedValue({
        ok: false,
        error: { status: 400, message: "All pending charges must be reviewed before invoice creation" },
      }),
    };
    const visitRepository = { findById: vi.fn().mockResolvedValue(ok(visit)) };
    const invoiceRepository = { findById: vi.fn() };
    const service = new VisitChargeService(
      chargeRepository as never,
      visitRepository as never,
      invoiceRepository as never,
    );

    const result = await service.createInvoiceFromVisit(actor, "visit1", {});

    expect(result.ok).toBe(false);
    expect(invoiceRepository.findById).not.toHaveBeenCalled();
  });

  it("creates invoice from reviewed visit charges via a single RPC", async () => {
    const chargeRepository = {
      createInvoiceFromVisit: vi.fn().mockResolvedValue(ok({ id: "invoice1" })),
    };
    const visitRepository = { findById: vi.fn().mockResolvedValue(ok(visit)) };
    const invoiceRepository = { findById: vi.fn().mockResolvedValue(ok({ id: "invoice1" })) };
    const service = new VisitChargeService(
      chargeRepository as never,
      visitRepository as never,
      invoiceRepository as never,
    );

    const result = await service.createInvoiceFromVisit(actor, "visit1", {});

    expect(result.ok).toBe(true);
    expect(chargeRepository.createInvoiceFromVisit).toHaveBeenCalledWith({
      visitId: "visit1",
      notes: null,
      createdByUserId: "owner1",
    });
    expect(invoiceRepository.findById).toHaveBeenCalledWith("invoice1");
  });

  it("exposes inventory, charge, invoice and payment entry points", () => {
    expect(source("app/api/inventory/route.ts")).toContain("listInventory");
    expect(source("app/api/inventory/[itemId]/adjust/route.ts")).toContain("adjustItem");
    expect(source("app/api/visits/[visitId]/charges/route.ts")).toContain("createForVisit");
    expect(source("app/api/visits/[visitId]/invoice/route.ts")).toContain("createInvoiceFromVisit");
    expect(source("app/api/payments/route.ts")).toContain("recordPayment");
    expect(source("components/dashboard/billing/visit-charges-panel.tsx")).toContain("אשר חיוב");
  });
});
