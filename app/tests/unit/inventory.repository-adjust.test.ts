import { describe, expect, it, vi } from "vitest";
import { InventoryRepository } from "@/lib/repositories/inventory.repository";

describe("InventoryRepository.adjust", () => {
  it("calls adjust_inventory_item RPC with clinic-scoped params", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "item1",
        clinic_id: "clinic1",
        name: "Vaccine",
        sku: null,
        category: "general",
        unit: "unit",
        quantity_on_hand: 4,
        reorder_level: 0,
        unit_cost: null,
        unit_price: null,
        active: true,
        created_by_user_id: "user1",
        version: 2,
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
        deleted_at: null,
      },
      error: null,
    });
    const repository = new InventoryRepository({ rpc } as never);

    const result = await repository.adjust("item1", {
      clinicId: "clinic1",
      quantityDelta: -1,
      reason: "usage",
      transactionType: "usage",
      sourceType: "visit",
      sourceId: "visit1",
      createdByUserId: "user1",
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("adjust_inventory_item", {
      p_item_id: "item1",
      p_clinic_id: "clinic1",
      p_quantity_delta: -1,
      p_reason: "usage",
      p_transaction_type: "usage",
      p_source_type: "visit",
      p_source_id: "visit1",
      p_created_by_user_id: "user1",
    });
    if (result.ok) expect(result.value.quantityOnHand).toBe(4);
  });

  it("maps negative-stock RPC errors to validation", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "inventory adjustment cannot make stock negative", code: "P0001" },
    });
    const repository = new InventoryRepository({ rpc } as never);

    const result = await repository.adjust("item1", {
      clinicId: "clinic1",
      quantityDelta: -99,
      reason: "usage",
      createdByUserId: "user1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toBe("Inventory adjustment cannot make stock negative");
    }
  });
});
