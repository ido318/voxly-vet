import { describe, expect, it, vi } from "vitest";
import { AuthService } from "@/lib/services/auth.service";
import { ok } from "@/lib/errors/app-error";

describe("AuthService.getProfile", () => {
  it("delegates to profileRepository.findByUserId", async () => {
    const profile = {
      id: "user-1",
      fullName: "Test User",
      phone: null,
      defaultClinicId: null,
      role: "provider_admin" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const findByUserId = vi.fn().mockResolvedValue(ok(profile));
    const service = new AuthService(
      {} as never,
      { findByUserId } as never,
      {} as never,
    );

    const result = await service.getProfile("user-1");

    expect(result).toEqual(ok(profile));
    expect(findByUserId).toHaveBeenCalledWith("user-1");
  });
});
