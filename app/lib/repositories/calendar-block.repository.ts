import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapCalendarBlockRow } from "@/lib/repositories/mappers";
import type {
  CalendarBlock,
  CalendarBlockListFilters,
  CreateCalendarBlockInput,
} from "@/types/domain/calendar-block";

type InsertCalendarBlockInput = CreateCalendarBlockInput & {
  createdBy: string;
};

export class CalendarBlockRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: CalendarBlockListFilters): Promise<Result<CalendarBlock[]>> {
    const { data, error } = await this.client
      .from("calendar_blocks")
      .select("*")
      .in("clinic_id", filters.clinicIds)
      .lt("start_at", filters.to)
      .gt("end_at", filters.from)
      .order("start_at", { ascending: true });

    if (error) return err(AppError.externalProvider("Failed to list calendar blocks", error));
    return ok((data ?? []).map(mapCalendarBlockRow));
  }

  async create(input: InsertCalendarBlockInput): Promise<Result<CalendarBlock>> {
    const { data, error } = await this.client
      .from("calendar_blocks")
      .insert({
        clinic_id: input.clinicId,
        start_at: input.startAt,
        end_at: input.endAt,
        reason: input.reason ?? null,
        created_by: input.createdBy,
      })
      .select("*")
      .single();

    if (error) return err(AppError.externalProvider("Failed to create calendar block", error));
    return ok(mapCalendarBlockRow(data));
  }

  async findById(blockId: string): Promise<Result<CalendarBlock | null>> {
    const { data, error } = await this.client
      .from("calendar_blocks")
      .select("*")
      .eq("id", blockId)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load calendar block", error));
    return ok(data ? mapCalendarBlockRow(data) : null);
  }

  async delete(blockId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from("calendar_blocks")
      .delete()
      .eq("id", blockId);

    if (error) return err(AppError.externalProvider("Failed to delete calendar block", error));
    return ok(undefined);
  }
}
