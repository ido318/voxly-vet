import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { ok, type Result } from "@/lib/errors/app-error";
import type { HealthResponse } from "@/types/api/me";

export class HealthService {
  constructor(private readonly adminClient: SupabaseClient) {}

  async check(): Promise<Result<HealthResponse>> {
    const env = getEnv();
    let db: HealthResponse["db"] = "degraded";

    const { error } = await this.adminClient
      .from("clinics")
      .select("id", { count: "exact", head: true });

    if (!error) {
      db = "connected";
    }

    return ok({
      status: "ok",
      env: env.APP_ENV,
      timestamp: new Date().toISOString(),
      db,
    });
  }
}
