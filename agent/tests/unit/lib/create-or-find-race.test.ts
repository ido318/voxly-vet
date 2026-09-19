import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Simulates the createOrFindCustomer/createOrFindPet race: two near-
// simultaneous calls for the same new phone number or pet name both pass the
// find-step before either inserts, so the loser's insert hits the unique
// index (customers_clinic_phone_unique_idx / pets_clinic_customer_name_unique_idx)
// as a 23505. bookAppointment is the entry point under test — the fix lives
// in store.ts's createOrFindCustomer/createOrFindPet, which is what should
// catch the 23505 and re-fetch instead of throwing.

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

describe("createOrFindCustomer/createOrFindPet race handling", () => {
  beforeEach(() => {
    appointmentInserts.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-fetches instead of throwing when a concurrent call wins the customer insert", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // findCustomerIdByPhone: not found yet
      .mockResolvedValueOnce({ data: { id: "customer-1" }, error: null }) // retry after the race: the winner's row
      .mockResolvedValueOnce({ data: null, error: null }); // findPetIdByName: no existing pet

    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "customers_clinic_phone_unique_idx"' },
      }) // customer insert loses the race
      .mockResolvedValueOnce({ data: { id: "pet-1" }, error: null }) // pet insert succeeds
      .mockResolvedValueOnce({ data: { id: "appt-1", scheduled_at: "2026-06-21T09:00:00+03:00" }, error: null }); // appointment insert succeeds

    const result = await bookAppointment({
      phone: "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name: "לונה",
      pet_species: "dog",
      visit_type: "vaccination",
      scheduled_at: "2026-06-21T09:00:00+03:00",
      reason: "חיסון כלבת",
    });

    expect(result).toContain("תור נקבע");
    expect(appointmentInserts).toHaveLength(1);
    expect((appointmentInserts[0] as { customer_id: string }).customer_id).toBe("customer-1");
  });

  it("re-fetches instead of throwing when a concurrent call wins the pet insert", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "customer-1" }, error: null }) // findCustomerIdByPhone: already exists
      .mockResolvedValueOnce({ data: null, error: null }) // findPetIdByName: not found yet
      .mockResolvedValueOnce({ data: { id: "pet-1" }, error: null }); // retry after the race: the winner's row

    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "pets_clinic_customer_name_unique_idx"' },
      }) // pet insert loses the race
      .mockResolvedValueOnce({ data: { id: "appt-1", scheduled_at: "2026-06-21T09:00:00+03:00" }, error: null }); // appointment insert succeeds

    const result = await bookAppointment({
      phone: "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name: "לונה",
      pet_species: "dog",
      visit_type: "vaccination",
      scheduled_at: "2026-06-21T09:00:00+03:00",
      reason: "חיסון כלבת",
    });

    expect(result).toContain("תור נקבע");
    expect(appointmentInserts).toHaveLength(1);
    expect((appointmentInserts[0] as { pet_id: string }).pet_id).toBe("pet-1");
  });
});
