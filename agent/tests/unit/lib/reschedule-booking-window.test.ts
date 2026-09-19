import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockRpc } = vi.hoisted(() => {
  const current = { scheduledAt: "2026-06-14T10:00:00+03:00" };
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "customer-1" }, error: null })),
    limit: vi.fn(() => Promise.resolve({
      data: [{
        id: "appt-1",
        customer_id: "customer-1",
        scheduled_at: current.scheduledAt,
        appointment_type: "checkup",
        duration_minutes: 40,
        customers: { full_name: "עידו" },
        pets: { name: "מיקה" },
      }],
      error: null,
    })),
  };

  return {
    mockFrom: vi.fn(() => builder),
    mockRpc: vi.fn(() => Promise.resolve({ data: "new-appt-1", error: null })),
  };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("../../../src/lib/notifications.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/notifications.js")>();
  return {
    ...actual,
    scheduleBookingNotifications: vi.fn().mockResolvedValue(undefined),
    cancelFutureNotifications: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../src/services/notification.processor.js", () => ({
  processNotifications: vi.fn().mockResolvedValue({ processed: 0, sent: 0, failed: 0 }),
}));

import { rescheduleAppointment } from "../../../src/lib/store.js";

describe("rescheduleAppointment booking window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T07:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call the reschedule RPC for a Saturday target slot", async () => {
    const result = await rescheduleAppointment(
      "0541234567",
      "2026-06-14T10:00:00+03:00",
      "2026-06-20T10:00:00+03:00",
    );

    expect(result).toContain("סגורה בשבת");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
