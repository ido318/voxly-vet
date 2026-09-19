import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// checkAvailability's appointments query must filter on the exact same
// status list as the appointments_no_active_overlap exclusion constraint
// (20260831102335_phase1_database_core_alignment.sql) — otherwise Tomer can
// offer a slot the DB will then reject on booking.

const { mockIn } = vi.hoisted(() => ({ mockIn: vi.fn() }));

vi.mock("../../../src/lib/supabase.js", () => {
  function chainFor() {
    const result = { data: [], error: null };
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: mockIn.mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  }

  return {
    getSupabase: vi.fn(() => ({
      from: () => chainFor(),
    })),
  };
});

import { checkAvailability } from "../../../src/lib/store.js";

describe("checkAvailability status filter", () => {
  beforeEach(() => {
    mockIn.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters appointments by the same statuses the DB exclusion constraint blocks on", async () => {
    await checkAvailability("2026-06-21", "checkup");

    expect(mockIn).toHaveBeenCalledWith("status", [
      "scheduled",
      "confirmed",
      "pending_approval",
      "checked_in",
      "in_visit",
    ]);
  });
});
