import { describe, expect, it, vi } from "vitest";
import { AuthService } from "@/lib/services/auth.service";
import { ok } from "@/lib/errors/app-error";

const testUser = { id: "user-1", email: "admin@example.com" };

describe("AuthService.getCurrentContext", () => {
  it("includes the profile's role in the returned MeResponse", async () => {
    const findByUserId = vi.fn().mockResolvedValue(
      ok({
        id: "user-1",
        fullName: "Test User",
        phone: null,
        defaultClinicId: null,
        role: "provider_admin" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      }),
    );
    const findMembershipsByUserId = vi.fn().mockResolvedValue(ok([]));
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }) },
    };
    const service = new AuthService(
      supabase as never,
      { findByUserId } as never,
      { findMembershipsByUserId } as never,
    );

    const result = await service.getCurrentContext();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.role).toBe("provider_admin");
  });

  it("defaults role to clinic_user when there is no profile row", async () => {
    const findByUserId = vi.fn().mockResolvedValue(ok(null));
    const findMembershipsByUserId = vi.fn().mockResolvedValue(ok([]));
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: testUser }, error: null }) },
    };
    const service = new AuthService(
      supabase as never,
      { findByUserId } as never,
      { findMembershipsByUserId } as never,
    );

    const result = await service.getCurrentContext();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.role).toBe("clinic_user");
  });
});
