import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calendarBlocks, appointments } = vi.hoisted(() => ({
  calendarBlocks: [
    {
      start_at: "2026-06-21T09:00:00+03:00",
      end_at: "2026-06-21T10:00:00+03:00",
      reason: "morning block",
    },
    {
      start_at: "2026-06-21T11:00:00+03:00",
      end_at: "2026-06-21T12:00:00+03:00",
      reason: "late morning block",
    },
  ],
  appointments: [],
}));

vi.mock("../../../src/lib/supabase.js", () => {
  function chainFor(table: string) {
    const result =
      table === "calendar_blocks"
        ? { data: calendarBlocks, error: null }
        : { data: appointments, error: null };

    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn(() => Promise.resolve(result)),
      limit: vi.fn(() => Promise.resolve({
        data: table === "calendar_blocks" ? calendarBlocks.slice(0, 1) : appointments,
        error: null,
      })),
      then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  }

  return {
    getSupabase: vi.fn(() => ({
      from: (table: string) => chainFor(table),
    })),
  };
});

import { checkAvailability } from "../../../src/lib/store.js";

describe("checkAvailability calendar blocks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes slots that overlap every calendar block on the requested day", async () => {
    const result = await checkAvailability("2026-06-21", "checkup");

    expect(result).toContain("scheduled_at=2026-06-21T10:20:00+03:00");
    expect(result).not.toContain("scheduled_at=2026-06-21T11:00:00+03:00");
  });
});
