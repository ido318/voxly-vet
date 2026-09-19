import { describe, expect, it, vi } from "vitest";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";

describe("AppointmentRepository.findActiveOverlaps", () => {
  it("treats scheduled, confirmed, pending approval, checked-in, and in-visit appointments as active blockers", async () => {
    const inFilter = vi.fn().mockReturnThis();
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: inFilter,
      is: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    const client = {
      from: vi.fn().mockReturnValue(query),
    };
    const repository = new AppointmentRepository(client as never);

    const result = await repository.findActiveOverlaps(
      "00000000-0000-4000-8000-000000000001",
      "2026-06-21T09:00:00+03:00",
      40,
    );

    expect(result.ok).toBe(true);
    expect(inFilter).toHaveBeenCalledWith("status", [
      "scheduled",
      "confirmed",
      "pending_approval",
      "checked_in",
      "in_visit",
    ]);
  });
});
