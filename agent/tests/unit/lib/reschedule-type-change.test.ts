import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockRpc, updateCalls, scheduledAtIso } = vi.hoisted(() => {
  // Always > 4 hours out (LATE_CANCEL_HOURS), regardless of when this test runs.
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const scheduledAtIso = `${futureDate.toISOString().slice(0, 10)}T14:00:00+03:00`;

  const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  let currentTable = "";
  let currentOperation: "select" | "update" | null = null;

  const builder = {
    select: vi.fn(() => {
      currentOperation = "select";
      return builder;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      currentOperation = "update";
      updateCalls.push({ table: currentTable, payload });
      return builder;
    }),
    eq: vi.fn(() => {
      if (currentTable === "appointments" && currentOperation === "update") {
        return Promise.resolve({ error: null });
      }
      return builder;
    }),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve({
      data: [{
        id: "appt-1",
        customer_id: "customer-1",
        scheduled_at: scheduledAtIso,
        appointment_type: "checkup",
        duration_minutes: 40,
        customers: { full_name: "עידו" },
        pets: { name: "מיקה" },
      }],
      error: null,
    })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "customer-1" }, error: null })),
  };

  const mockFrom = vi.fn((table: string) => {
    currentTable = table;
    currentOperation = null;
    return builder;
  });
  const mockRpc = vi.fn(() => Promise.resolve({ data: "new-appt-1", error: null }));

  return { mockFrom, mockRpc, updateCalls, scheduledAtIso };
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
    enqueueClientCancellationConfirmation: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../src/services/notification.processor.js", () => ({
  processNotifications: vi.fn().mockResolvedValue({ processed: 0, sent: 0, failed: 0 }),
}));

import { rescheduleAppointment } from "../../../src/lib/store.js";

describe("rescheduleAppointment — same-slot visit type correction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCalls.length = 0;
  });

  it("updates the existing appointment when only the visit type changes", async () => {
    const result = await rescheduleAppointment(
      "0541234567",
      scheduledAtIso,
      scheduledAtIso,
      "vaccination",
    );

    expect(result).toContain("סוג התור עודכן");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([
      {
        table: "appointments",
        payload: {
          appointment_type: "vaccination",
          duration_minutes: 30,
          status: "scheduled",
          changed_via: "agent",
        },
      },
    ]);
  });
});
