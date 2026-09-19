import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapPriceListItemRow } from "@/lib/repositories/mappers";
import type {
  CreatePriceListItemInput,
  PriceListItem,
  UpdatePriceListItemInput,
} from "@/types/domain/price-list-item";

export class PriceListItemRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(clinicIds: string[]): Promise<Result<PriceListItem[]>> {
    const { data, error } = await this.client
      .from("price_list_items")
      .select("*")
      .in("clinic_id", clinicIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return err(AppError.externalProvider("Failed to list price list items", error));
    return ok((data ?? []).map(mapPriceListItemRow));
  }

  async findById(itemId: string): Promise<Result<PriceListItem | null>> {
    const { data, error } = await this.client
      .from("price_list_items")
      .select("*")
      .eq("id", itemId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load price list item", error));
    return ok(data ? mapPriceListItemRow(data) : null);
  }

  async create(
    input: CreatePriceListItemInput & { createdByUserId: string },
  ): Promise<Result<PriceListItem>> {
    const { data, error } = await this.client
      .from("price_list_items")
      .insert({
        clinic_id: input.clinicId,
        name: input.name,
        default_price: input.defaultPrice,
        visit_type: input.visitType ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to create price list item", error));
    return ok(mapPriceListItemRow(data));
  }

  async updateVersioned(
    itemId: string,
    expectedVersion: number,
    patch: Omit<UpdatePriceListItemInput, "version">,
  ): Promise<Result<PriceListItem>> {
    const update: Record<string, unknown> = { version: expectedVersion + 1 };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.defaultPrice !== undefined) update.default_price = patch.defaultPrice;
    if (patch.active !== undefined) update.active = patch.active;

    const { data, error } = await this.client
      .from("price_list_items")
      .update(update)
      .eq("id", itemId)
      .eq("version", expectedVersion)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Price list item update conflict: stale version", {
            itemId,
            expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to update price list item", error));
    }
    return ok(mapPriceListItemRow(data));
  }
}
