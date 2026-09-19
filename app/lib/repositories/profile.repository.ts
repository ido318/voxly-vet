import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapProfileRow } from "@/lib/repositories/mappers";
import type { Profile } from "@/types/domain/profile";

export class ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Result<Profile | null>> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return err(AppError.externalProvider("Failed to load profile", error));
    }

    return ok(data ? mapProfileRow(data) : null);
  }
}
