import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { appointmentInserts, mockSingle, mockMaybeSingle } = vi.hoisted(() => {
  const appointmentInserts: unknown[] = [];
  return {
    appointmentInserts,
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
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
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
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

describe("bookAppointment booking window", () => {
  beforeEach(() => {
    appointmentInserts.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T07:00:00Z"));
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: { id: "row-1" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not insert when the requested date is more than 14 days ahead", async () => {
    const result = await bookAppointment({
      phone: "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name: "לונה",
      pet_species: "dog",
      visit_type: "checkup",
      scheduled_at: "2026-06-26T10:00:00+03:00",
    });

    expect(result).toContain("14 יום");
    expect(appointmentInserts).toHaveLength(0);
  });

  it("does not insert when the requested day is Saturday", async () => {
    const result = await bookAppointment({
      phone: "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name: "לונה",
      pet_species: "dog",
      visit_type: "checkup",
      scheduled_at: "2026-06-20T10:00:00+03:00",
    });

    expect(result).toContain("סגורה בשבת");
    expect(appointmentInserts).toHaveLength(0);
  });
});
