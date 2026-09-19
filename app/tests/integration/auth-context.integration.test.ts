import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { ClinicRepository } from "@/lib/repositories/clinic.repository";
import { ProfileRepository } from "@/lib/repositories/profile.repository";
import { AuthService } from "@/lib/services/auth.service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(supabaseUrl && anonKey);

const email = process.env.DEV_USER_EMAIL ?? "owner@demo-clinic.local";
const password = process.env.DEV_USER_PASSWORD ?? "dev-password-change-me";

describe.runIf(runIntegration)("AuthService.getCurrentContext", () => {
  let client: ReturnType<typeof createClient>;

  beforeAll(async () => {
    resetEnvCache();
    client = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Failed to sign in dev user: ${error.message}`);
    }
  });

  afterAll(async () => {
    await client.auth.signOut();
  });

  it("returns user profile and clinic memberships", async () => {
    const authService = new AuthService(
      client,
      new ProfileRepository(client),
      new ClinicRepository(client),
    );

    const result = await authService.getCurrentContext();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.email).toBe(email);
      expect(result.value.memberships.length).toBeGreaterThan(0);
      expect(result.value.memberships[0]?.role).toBe("owner");
    }
  });
});
