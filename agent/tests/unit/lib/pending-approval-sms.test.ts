/**
 * Verifies that neutering (pending_approval) appointments do NOT trigger
 * booking notifications at the time of booking by Tomer.
 * Notifications are created only when Dana approves the appointment in the dashboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted lets us share mocks across the hoisted vi.mock factories
const { mockSingle, mockMaybeSingle, mockSchedule } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({
    data: { id: "appt-123", scheduled_at: "2026-06-20T10:00:00Z" },
    error: null,
  });
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSchedule = vi.fn().mockResolvedValue(undefined);
  return { mockSingle, mockMaybeSingle, mockSchedule };
});

// Build a chainable Supabase mock
vi.mock("../../../src/lib/supabase.js", () => {
  const chain: Record<string, unknown> = {};
  const chainMethods = [
    "from", "select", "insert", "upsert", "update",
    "eq", "in", "gte", "lte", "lt", "is", "ilike",
    "order", "limit", "range", "not", "neq",
  ];
  chainMethods.forEach((m) => { chain[m] = vi.fn().mockReturnValue(chain); });
  chain["single"] = mockSingle;
  chain["maybeSingle"] = mockMaybeSingle;
  return { getSupabase: vi.fn().mockReturnValue(chain) };
});

vi.mock("../../../src/lib/notifications.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/notifications.js")>();
  return {
    ...actual,
    scheduleBookingNotifications: mockSchedule,
    processNotifications: vi.fn().mockResolvedValue(undefined),
    cancelFutureNotifications: vi.fn().mockResolvedValue(undefined),
    enqueueRescheduleNotification: vi.fn().mockResolvedValue(undefined),
    enqueueCancellationNotification: vi.fn().mockResolvedValue(undefined),
    enqueueClientCancellationConfirmation: vi.fn().mockResolvedValue(undefined),
  };
});

import { bookAppointment } from "../../../src/lib/store.js";

describe("bookAppointment — pending_approval (neutering) must not create notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T07:00:00Z"));
    mockSingle.mockResolvedValue({
      data: { id: "appt-123", scheduled_at: "2026-06-16T10:00:00+03:00" },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSchedule.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT call scheduleBookingNotifications when visit_type=neutering", async () => {
    const result = await bookAppointment({
      phone:         "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name:      "לונה",
      pet_species:   "dog",
      visit_type:    "neutering",
      scheduled_at:  "2026-06-16T10:00:00+03:00",
    });

    // The booking should succeed and return a pending_approval message
    expect(result).toContain("ממתין לאישור");
    // scheduleBookingNotifications must NOT be called for pending_approval
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("DOES call scheduleBookingNotifications for a regular checkup", async () => {
    const result = await bookAppointment({
      phone:         "0541234567",
      customer_name: "יעל ברקוביץ",
      pet_name:      "לונה",
      pet_species:   "dog",
      visit_type:    "checkup",
      scheduled_at:  "2026-06-16T10:00:00+03:00",
    });

    expect(result).toContain("תור נקבע");
    expect(result).not.toContain("✅");
    expect(result).not.toContain("SMS");
    expect(result.length).toBeLessThanOrEqual(80);
    // scheduleBookingNotifications MUST be called for normal bookings
    expect(mockSchedule).toHaveBeenCalledOnce();
  });
});
