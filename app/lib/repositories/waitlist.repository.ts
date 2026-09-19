import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapWaitlistRow } from "@/lib/repositories/mappers";
import type { WaitlistEntry, WaitlistListFilters } from "@/types/domain/waitlist";

export class WaitlistRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: WaitlistListFilters): Promise<Result<WaitlistEntry[]>> {
    const { data, error } = await this.client
      .from("waitlist")
      .select(`
        *,
        customer:customers!waitlist_customer_clinic_fk(full_name, phone),
        pet:pets!waitlist_pet_clinic_fk(name)
      `)
      .in("clinic_id", filters.clinicIds)
      .order("created_at", { ascending: true });

    if (error) return err(AppError.externalProvider("Failed to list waitlist entries", error));
    return ok((data ?? []).map(mapWaitlistRow));
  }
}
