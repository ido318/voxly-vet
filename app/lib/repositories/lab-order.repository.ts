import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapLabOrderRow } from "@/lib/repositories/mappers";
import type {
  CreateLabOrderInput,
  LabOrder,
  LabOrderListFilters,
} from "@/types/domain/lab-order";

const SELECT_WITH_JOINS = `
  *,
  customer:customers!lab_orders_customer_clinic_fk(full_name),
  pet:pets!lab_orders_pet_clinic_fk(name)
`;

export class LabOrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: LabOrderListFilters): Promise<Result<LabOrder[]>> {
    let query = this.client
      .from("lab_orders")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("ordered_at", { ascending: false });

    if (filters.petId) query = query.eq("pet_id", filters.petId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list lab orders", error));
    return ok((data ?? []).map(mapLabOrderRow));
  }

  async findById(labOrderId: string): Promise<Result<LabOrder | null>> {
    const { data, error } = await this.client
      .from("lab_orders")
      .select(SELECT_WITH_JOINS)
      .eq("id", labOrderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load lab order", error));
    return ok(data ? mapLabOrderRow(data) : null);
  }

  async create(input: CreateLabOrderInput & { orderedByUserId: string }): Promise<Result<LabOrder>> {
    const { data, error } = await this.client
      .from("lab_orders")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId,
        visit_id: input.visitId ?? null,
        test_name: input.testName,
        ordered_by_user_id: input.orderedByUserId,
      })
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) return err(AppError.externalProvider("Failed to create lab order", error));
    return ok(mapLabOrderRow(data));
  }

  async updateVersioned(
    labOrderId: string,
    expectedVersion: number,
    patch: Record<string, unknown>,
  ): Promise<Result<LabOrder>> {
    const { data, error } = await this.client
      .from("lab_orders")
      .update({ ...patch, version: expectedVersion + 1 })
      .eq("id", labOrderId)
      .eq("version", expectedVersion)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Lab order update conflict: stale version", {
            labOrderId,
            expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to update lab order", error));
    }
    return ok(mapLabOrderRow(data));
  }
}
