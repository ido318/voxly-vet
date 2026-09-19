import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { PriceListItemService } from "@/lib/services/price-list-item.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { PriceListItem } from "@/types/domain/price-list-item";

const CLINIC = "clinic-1";
const ownerActor: ServiceActor = {
  userId: "user-1",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "owner" }],
};
const staffActor: ServiceActor = {
  userId: "user-2",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "veterinarian" }],
};

function makeItem(overrides: Partial<PriceListItem> = {}): PriceListItem {
  return {
    id: "item-1",
    clinicId: CLINIC,
    name: "בדיקה כללית",
    defaultPrice: 150,
    visitType: "checkup",
    active: true,
    createdByUserId: "user-1",
    version: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildService(item: PriceListItem | null = makeItem()) {
  const repository = {
    list: vi.fn(async () => ok([item].filter(Boolean) as PriceListItem[])),
    findById: vi.fn(async () => ok(item)),
    create: vi.fn(async () => ok(makeItem({ id: "item-2", name: "פריט חדש", defaultPrice: 80 }))),
    updateVersioned: vi.fn(async () => ok({ ...(item as PriceListItem), name: "עודכן", version: 1 })),
  };
  const service = new PriceListItemService(repository as never);
  return { service, repository };
}

describe("PriceListItemService.createItem", () => {
  it("allows an owner to create a price list item", async () => {
    const { service, repository } = buildService();

    const result = await service.createItem(ownerActor, {
      clinicId: CLINIC,
      name: "פריט חדש",
      defaultPrice: 80,
    });

    expect(result.ok).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC, name: "פריט חדש", createdByUserId: "user-1" }),
    );
  });

  it("forbids a non owner/admin actor from creating a price list item", async () => {
    const { service, repository } = buildService();

    const result = await service.createItem(staffActor, {
      clinicId: CLINIC,
      name: "פריט חדש",
      defaultPrice: 80,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("forbids creating a price list item for a clinic the actor is not a member of", async () => {
    const { service } = buildService();

    const result = await service.createItem(ownerActor, {
      clinicId: "other-clinic",
      name: "פריט חדש",
      defaultPrice: 80,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
  });
});

describe("PriceListItemService.updateItem", () => {
  it("allows an owner to edit the default price", async () => {
    const { service, repository } = buildService();

    const result = await service.updateItem(ownerActor, "item-1", { version: 0, defaultPrice: 200 });

    expect(result.ok).toBe(true);
    expect(repository.updateVersioned).toHaveBeenCalledWith("item-1", 0, { defaultPrice: 200 });
  });

  it("returns not found when the item doesn't exist", async () => {
    const { service } = buildService(null);

    const result = await service.updateItem(ownerActor, "missing", { version: 0, defaultPrice: 200 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(404);
  });

  it("forbids a non owner/admin actor from editing", async () => {
    const { service, repository } = buildService();

    const result = await service.updateItem(staffActor, "item-1", { version: 0, defaultPrice: 200 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(repository.updateVersioned).not.toHaveBeenCalled();
  });
});
