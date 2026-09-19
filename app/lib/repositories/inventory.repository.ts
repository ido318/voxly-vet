import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapInventoryItemRow } from "@/lib/repositories/mappers";
import type {
  CreateInventoryItemInput,
  InventoryAdjustmentInput,
  InventoryItem,
} from "@/types/domain/inventory";

export class InventoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(clinicIds: string[]): Promise<Result<InventoryItem[]>> {
    const { data, error } = await this.client
      .from("inventory_items")
      .select("*")
      .in("clinic_id", clinicIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) return err(AppError.externalProvider("Failed to list inventory", error));
    return ok((data ?? []).map(mapInventoryItemRow));
  }

  async create(input: CreateInventoryItemInput & { createdByUserId: string }): Promise<Result<InventoryItem>> {
    const { data, error } = await this.client
      .from("inventory_items")
      .insert({
        clinic_id: input.clinicId,
        name: input.name,
        sku: input.sku ?? null,
        category: input.category ?? "general",
        unit: input.unit ?? "unit",
        quantity_on_hand: input.quantityOnHand ?? 0,
        reorder_level: input.reorderLevel ?? 0,
        unit_cost: input.unitCost ?? null,
        unit_price: input.unitPrice ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create inventory item", error));
    return ok(mapInventoryItemRow(data));
  }

  async adjust(
    itemId: string,
    input: InventoryAdjustmentInput & { clinicId: string; createdByUserId: string },
  ): Promise<Result<InventoryItem>> {
    const { data, error } = await this.client.rpc("adjust_inventory_item", {
      p_item_id: itemId,
      p_clinic_id: input.clinicId,
      p_quantity_delta: input.quantityDelta,
      p_reason: input.reason,
      p_transaction_type: input.transactionType ?? "adjustment",
      p_source_type: input.sourceType ?? "manual",
      p_source_id: input.sourceId ?? null,
      p_created_by_user_id: input.createdByUserId,
    });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("cannot make stock negative")) {
        return err(AppError.validation("Inventory adjustment cannot make stock negative"));
      }
      if (message.includes("quantity delta must not be zero") || message.includes("reason is required")) {
        return err(AppError.validation(message));
      }
      if (message.includes("inventory item not found")) {
        return err(AppError.notFound("Inventory item not found"));
      }
      return err(AppError.externalProvider("Failed to adjust inventory item", error));
    }
    return ok(mapInventoryItemRow(data as Record<string, unknown>));
  }
}
