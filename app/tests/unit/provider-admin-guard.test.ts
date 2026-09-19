import { describe, expect, it, vi } from "vitest";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { ok, err, AppError } from "@/lib/errors/app-error";
import type { Profile } from "@/types/domain/profile";
import type { User } from "@supabase/supabase-js";

const testUser = { id: "user-1", email: "admin@voxly-ai.com" } as User;

function adminProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    fullName: null,
    phone: null,
    defaultClinicId: null,
    role: "provider_admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildAuthService(overrides: { getSessionUser?: unknown; getProfile?: unknown } = {}) {
  return {
    getSessionUser: overrides.getSessionUser ?? vi.fn().mockResolvedValue(ok(testUser)),
    getProfile: overrides.getProfile ?? vi.fn().mockResolvedValue(ok(adminProfile())),
  } as never;
}

describe("requireProviderAdmin", () => {
  it("throws unauthorized when there is no session", async () => {
    const authService = buildAuthService({ getSessionUser: vi.fn().mockResolvedValue(ok(null)) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 401 });
  });

  it("propagates a getSessionUser error result as a thrown error", async () => {
    const authService = buildAuthService({ getSessionUser: vi.fn().mockResolvedValue(err(AppError.unauthorized())) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 401 });
  });

  it("throws forbidden when the profile role is clinic_user", async () => {
    const authService = buildAuthService({
      getProfile: vi.fn().mockResolvedValue(ok(adminProfile({ role: "clinic_user" }))),
    });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 403 });
  });

  it("throws forbidden when there is no profile row at all", async () => {
    const authService = buildAuthService({ getProfile: vi.fn().mockResolvedValue(ok(null)) });
    await expect(requireProviderAdmin(authService)).rejects.toMatchObject({ status: 403 });
  });

  it("returns the user and profile when role is provider_admin", async () => {
    const authService = buildAuthService();
    const result = await requireProviderAdmin(authService);
    expect(result.user.id).toBe("user-1");
    expect(result.profile.role).toBe("provider_admin");
  });
});
