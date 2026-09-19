import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appointmentInserts,
  mockSingle,
  mockMaybeSingle,
  mockLimit,
  mockLte,
  mockGt,
} = vi.hoisted(() => {
  const appointmentInserts: unknown[] = [];
  return {
    appointmentInserts,
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockLimit: vi.fn(),
    mockLte: vi.fn(),
    mockGt: vi.fn(),
  };
});

vi.mock("../../../src/lib/supabase.js", () => {
  function chainFor(table: string) {
    const chain: Record<string, unknown> = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn((payload: unknown) => {
        if (table === "appointments") appointmentInserts.push(payload);
        return chain;
      }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: mockGt,
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      limit: mockLimit,
      lte: mockLte,
    };
    return chain;
  }

  return {
    getSupabase: vi.fn(() => ({
      from: (table: string) => chainFor(table),
    })),
  };
});

vi.mock("../../../src/lib/notifications.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/notifications.js")>();
  return {
    ...actual,
    scheduleBookingNotifications: vi.fn().mockResolvedValue(undefined),
  };
});

import { bookAppointment } from "../../../src/lib/store.js";

describe("bookAppointment conflict handling", () => {
  beforeEach(() => {
    appointmentInserts.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T06:00:00Z"));

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "customer-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "pet-1" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23P01",
          message: "appointments_no_active_overlap",
        },
      });
    mockGt.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockLte.mockResolvedValue({
      data: [
        {
          scheduled_at: "2026-06-21T09:00:00+03:00",
          end_at: "2026-06-21T09:30:00+03:00",
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not confirm the booking and suggests a fresh alternative when the slot was taken", async () => {
    const result = await bookAppointment({
      phone: "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name: "לונה",
      pet_species: "dog",
      visit_type: "vaccination",
      scheduled_at: "2026-06-21T09:00:00+03:00",
      reason: "חיסון כלבת",
    });

    expect(appointmentInserts).toHaveLength(1);
    expect(result).not.toContain("תור נקבע");
    expect(result).toContain("השעה הזו כבר תפוסה");
    expect(result).toContain("09:30");
    expect(result).toContain("scheduled_at=2026-06-21T09:30:00+03:00");
  });
});
