import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isQuietHours,
  nextSendableTime,
  morningReminderTime,
  israelDateIso,
  enqueueNotification,
  scheduleBookingNotifications,
  cancelFutureNotifications,
  enqueueRescheduleNotification,
  enqueueClientCancellationConfirmation,
} from "../../../src/lib/notifications.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase (all writes succeed by default)
// ─────────────────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockEq = vi.fn();
const mockIn = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn();
const mockPriceRow = vi.fn();
const mockSingle = vi.fn().mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Chain builder: from(...).upsert() or from(...).update().eq().eq().in()
  mockIn.mockResolvedValue({ error: null });
  mockEq.mockReturnValue({ eq: mockEq, in: mockIn, error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockUpsert.mockResolvedValue({ error: null });
  mockSingle.mockResolvedValue({ data: { settings: { smsTemplates: {} } }, error: null });

  // The booking SMS price now comes from the clinic's editable price list
  // rather than a hardcoded map, so this is the third table read here.
  mockPriceRow.mockResolvedValue({
    data: { default_price: 150, agent_quotable: true },
    error: null,
  });

  // Branch by table: "clinics" is read for SMS template overrides via
  // .select().eq().single(); "price_list_items" for the price segment via
  // .select().eq()…maybeSingle(); every other table keeps the existing
  // upsert/update chain used by notifications_log.
  mockFrom.mockImplementation((table: string) => {
    if (table === "clinics") {
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle };
    }
    if (table === "price_list_items") {
      const chain: Record<string, unknown> = {};
      chain["select"] = vi.fn().mockReturnValue(chain);
      chain["eq"] = vi.fn().mockReturnValue(chain);
      chain["is"] = vi.fn().mockReturnValue(chain);
      chain["maybeSingle"] = mockPriceRow;
      return chain;
    }
    return { upsert: mockUpsert, update: mockUpdate };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isQuietHours — tests DST (Jan = UTC+2, Jul = UTC+3)
// ─────────────────────────────────────────────────────────────────────────────

describe("isQuietHours", () => {
  it("returns false at 10:00 Israel time in winter (UTC+2)", () => {
    // 2026-01-15T08:00:00Z = 10:00 Israel (UTC+2)
    expect(isQuietHours(new Date("2026-01-15T08:00:00Z"))).toBe(false);
  });

  it("returns false at 10:00 Israel time in summer (UTC+3)", () => {
    // 2026-07-15T07:00:00Z = 10:00 Israel (UTC+3)
    expect(isQuietHours(new Date("2026-07-15T07:00:00Z"))).toBe(false);
  });

  it("returns true at 22:00 Israel time (both seasons)", () => {
    // 2026-01-15T20:00:00Z = 22:00 Israel (UTC+2) — winter
    expect(isQuietHours(new Date("2026-01-15T20:00:00Z"))).toBe(true);
    // 2026-07-15T19:00:00Z = 22:00 Israel (UTC+3) — summer
    expect(isQuietHours(new Date("2026-07-15T19:00:00Z"))).toBe(true);
  });

  it("returns true at 06:00 Israel (before 08:00 cutoff)", () => {
    // 2026-06-15T03:00:00Z = 06:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T03:00:00Z"))).toBe(true);
  });

  it("returns false at exactly 08:00 Israel", () => {
    // 2026-06-15T05:00:00Z = 08:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T05:00:00Z"))).toBe(false);
  });

  it("returns true at exactly 21:00 Israel", () => {
    // 2026-06-15T18:00:00Z = 21:00 Israel (UTC+3 summer)
    expect(isQuietHours(new Date("2026-06-15T18:00:00Z"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// morningReminderTime — 08:00 Israel for a given date
// ─────────────────────────────────────────────────────────────────────────────

describe("morningReminderTime", () => {
  it("returns 05:00 UTC for a summer date (UTC+3 → 08:00 Israel)", () => {
    const t = morningReminderTime("2026-07-15");
    expect(t.toISOString()).toBe("2026-07-15T05:00:00.000Z");
  });

  it("returns 06:00 UTC for a winter date (UTC+2 → 08:00 Israel)", () => {
    const t = morningReminderTime("2026-01-15");
    expect(t.toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("israelHour of returned Date is 8", () => {
    // Verify via israelDateIso that the date is correct
    const t = morningReminderTime("2026-06-17");
    expect(israelDateIso(t)).toBe("2026-06-17");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nextSendableTime
// ─────────────────────────────────────────────────────────────────────────────

describe("nextSendableTime", () => {
  it("returns the same time when not in quiet hours", () => {
    // 10:00 Israel = not quiet
    const now = new Date("2026-06-15T07:00:00Z"); // 10:00 Israel (UTC+3)
    expect(nextSendableTime(now)).toBe(now);
  });

  it("defers to 08:00 same morning when before morning cutoff", () => {
    // 03:00 Israel (quiet) — morning has not yet passed
    const now = new Date("2026-06-15T00:00:00Z"); // 03:00 Israel
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-06-15T05:00:00.000Z"); // 08:00 Israel UTC+3
  });

  it("defers to 08:00 next morning when in evening quiet hours", () => {
    // 22:00 Israel (quiet) — today's morning has passed
    const now = new Date("2026-06-15T19:00:00Z"); // 22:00 Israel (UTC+3)
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-06-16T05:00:00.000Z"); // 08:00 next day
  });

  it("crosses DST boundary correctly (winter evening → next morning)", () => {
    // 22:00 Israel on 2026-01-15 (UTC+2) = 20:00 UTC
    const now = new Date("2026-01-15T20:00:00Z");
    const result = nextSendableTime(now);
    expect(result.toISOString()).toBe("2026-01-16T06:00:00.000Z"); // 08:00 Israel UTC+2
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// israelDateIso
// ─────────────────────────────────────────────────────────────────────────────

describe("israelDateIso", () => {
  it("returns Israel date not UTC date when crossing midnight", () => {
    // 2026-06-17T22:30:00Z = 01:30 on 2026-06-18 in Israel (UTC+3)
    expect(israelDateIso(new Date("2026-06-17T22:30:00Z"))).toBe("2026-06-18");
  });

  it("returns same day when UTC and Israel share the same date", () => {
    // 2026-06-17T10:00:00Z = 13:00 in Israel
    expect(israelDateIso(new Date("2026-06-17T10:00:00Z"))).toBe("2026-06-17");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enqueueNotification — idempotency via upsert with ignoreDuplicates
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueNotification", () => {
  it("calls upsert with correct shape", async () => {
    const params = {
      clinicId:      "clinic-1",
      customerId:    "cust-1",
      appointmentId: "appt-1",
      phone:         "+972501234567",
      type:          "booking_confirmation" as const,
      body:          "Hello",
      scheduledFor:  new Date("2026-06-17T05:00:00Z"),
    };
    await enqueueNotification(params);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment_id: "appt-1",
        type:           "booking_confirmation",
        status:         "pending",
      }),
      expect.objectContaining({ onConflict: "appointment_id,type", ignoreDuplicates: true }),
    );
  });

  it("throws when Supabase returns an error", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "DB error" } });
    await expect(
      enqueueNotification({
        clinicId: "c", customerId: "cu", appointmentId: "a", phone: "+972500000000",
        type: "booking_confirmation", body: "x", scheduledFor: new Date(),
      }),
    ).rejects.toThrow("enqueueNotification failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelFutureNotifications
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelFutureNotifications", () => {
  it("calls update with status=skipped for the given appointment", async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockChain: Record<string, unknown> = { in: mockIn };
    mockChain.eq = vi.fn().mockReturnValue(mockChain);
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue(mockChain) });

    await expect(cancelFutureNotifications("appt-1", "clinic-1")).resolves.toBeUndefined();

    // M11: must also catch rows the atomic-claim processor already has
    // 'processing' — not just 'pending' — or a cancellation can lose the
    // race with an in-flight send.
    expect(mockIn).toHaveBeenCalledWith("status", ["pending", "processing"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scheduleBookingNotifications — enqueues 3 rows
// ─────────────────────────────────────────────────────────────────────────────

describe("scheduleBookingNotifications", () => {
  it("enqueues booking_confirmation, morning_reminder, arrival_reminder, and post_visit_followup", async () => {
    // Use a future appointment (14 days ahead) so time-based reminders are enqueued,
    // regardless of when the test runs.
    const futureAppt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     futureAppt,
      durationMinutes: 40,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972501234567",
      customerName:    "שרה",
      petName:         "ביסלי",
    });

    // upsert called 4 times (one per notification type)
    expect(mockUpsert).toHaveBeenCalledTimes(4);

    const types = mockUpsert.mock.calls.map(
      (call) => (call[0] as { type: string }).type,
    );
    expect(types).toContain("booking_confirmation");
    expect(types).toContain("morning_reminder");
    expect(types).toContain("arrival_reminder");
    expect(types).toContain("post_visit_followup");
  });

  it("skips morning_reminder when appointment time is in the past (morning already passed)", async () => {
    // Appointment was yesterday — morning_reminder time would be in the past
    await scheduleBookingNotifications({
      appointmentId:   "appt-2",
      scheduledAt:     "2026-06-10T08:00:00+03:00", // past date
      durationMinutes: 40,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972501234567",
      customerName:    "שרה",
      petName:         "ביסלי",
    });

    const types = mockUpsert.mock.calls.map(
      (call) => (call[0] as { type: string }).type,
    );
    expect(types).not.toContain("morning_reminder");
    expect(types).not.toContain("arrival_reminder");
    expect(types).toContain("booking_confirmation");
    expect(types).toContain("post_visit_followup");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enqueueRescheduleNotification
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueRescheduleNotification", () => {
  it("enqueues reschedule_update with correct wording (not 'client cancellation')", async () => {
    // cancelFutureNotifications chain
    const mockChain = { eq: vi.fn().mockReturnThis() };
    mockChain.eq.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockChain).mockReturnValueOnce({ error: null });
    mockFrom.mockImplementation((table: string) =>
      table === "clinics"
        ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }
        : { update: vi.fn().mockReturnValue(mockChain), upsert: mockUpsert },
    );

    await enqueueRescheduleNotification({
      appointmentId:   "appt-1",
      oldScheduledAt:  "2026-07-17T07:00:00Z",
      newScheduledAt:  "2026-07-18T08:00:00Z",
      durationMinutes: 40,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972501234567",
      customerName:    "שרה",
      petName:         "ביסלי",
    });

    expect(mockUpsert).toHaveBeenCalledOnce();
    const call = mockUpsert.mock.calls[0]![0] as { type: string; body: string };
    expect(call.type).toBe("reschedule_update");
    expect(call.body).toContain("עודכן");
    expect(call.body).not.toContain("בוטל לבקשתכם");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enqueueClientCancellationConfirmation — correct template, not cancellation_update
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueClientCancellationConfirmation", () => {
  it("sends client_cancellation_confirmation (client-requested wording, not 'אילוץ רפואי')", async () => {
    // cancelFutureNotifications chain (called first, internally)
    const mockChain: Record<string, unknown> = { in: vi.fn().mockResolvedValue({ error: null }) };
    mockChain.eq = vi.fn().mockReturnValue(mockChain);
    mockFrom.mockImplementation((table: string) =>
      table === "clinics"
        ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }
        : { update: vi.fn().mockReturnValue(mockChain), upsert: mockUpsert },
    );

    await enqueueClientCancellationConfirmation({
      appointmentId: "appt-1",
      scheduledAt:   "2026-07-17T07:00:00Z",
      clinicId:      "clinic-1",
      customerId:    "cust-1",
      phone:         "+972501234567",
      customerName:  "שרה",
      petName:       "ביסלי",
    });

    expect(mockUpsert).toHaveBeenCalledOnce();
    const call = mockUpsert.mock.calls[0]![0] as { type: string; body: string };
    expect(call.type).toBe("client_cancellation_confirmation");
    // Uses client-requested wording, NOT the "אילוץ רפואי" dashboard wording
    expect(call.body).toContain("בוטל לבקשתכם");
    expect(call.body).not.toContain("אילוץ רפואי");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Clinic SMS template overrides — resolveSmsTemplate honors clinics.settings.smsTemplates
// ─────────────────────────────────────────────────────────────────────────────

describe("clinic SMS template overrides", () => {
  it("scheduleBookingNotifications uses the clinic's booking_confirmation override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { booking_confirmation: "אישרנו! {{petName}}" } } },
      error: null,
    });

    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    const bookingCall = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "booking_confirmation");
    expect((bookingCall![0] as { body: string }).body).toBe("אישרנו! מיקה");
  });

  it("scheduleBookingNotifications falls back to default wording when the clinic has no override", async () => {
    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    const bookingCall = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "booking_confirmation");
    expect((bookingCall![0] as { body: string }).body).toContain("נקבע בהצלחה"); // default wording
  });

  it("scheduleBookingNotifications uses the clinic's morning_reminder override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { morning_reminder: "תזכורת בוקר: {{time}} ב-{{location}}" } } },
      error: null,
    });

    // Far-future appointment so morning_reminder (08:00 Israel day-of) is
    // still ahead of "now" regardless of when the test runs.
    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    const call = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "morning_reminder");
    expect(call).toBeDefined();
    expect((call![0] as { body: string }).body).toContain("תזכורת בוקר:");
    expect((call![0] as { body: string }).body).not.toContain("{{time}}");
  });

  it("scheduleBookingNotifications uses the clinic's arrival_reminder override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { arrival_reminder: "מגיעים בעוד שעתיים ל-{{location}}" } } },
      error: null,
    });

    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    const call = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "arrival_reminder");
    expect(call).toBeDefined();
    expect((call![0] as { body: string }).body).toContain("מגיעים בעוד שעתיים ל-");
    expect((call![0] as { body: string }).body).not.toContain("{{location}}");
  });

  it("scheduleBookingNotifications uses the clinic's post_visit_followup override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { post_visit_followup: "מקווים ש{{petName}} מרגיש טוב, {{customerName}}" } } },
      error: null,
    });

    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    const call = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "post_visit_followup");
    expect(call).toBeDefined();
    expect((call![0] as { body: string }).body).toBe("מקווים שמיקה מרגיש טוב, דנה");
  });

  it("scheduleBookingNotifications falls back to default wording when the clinics lookup errors", async () => {
    // Simulate a Supabase error reading clinics.settings — getSmsTemplateOverrides
    // must swallow it and return {}, not throw or block the booking flow.
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    await scheduleBookingNotifications({
      appointmentId:   "appt-1",
      scheduledAt:     "2027-01-15T10:00:00.000Z",
      durationMinutes: 30,
      visitType:       "checkup",
      clinicId:        "clinic-1",
      customerId:      "cust-1",
      phone:           "+972500000000",
      customerName:    "דנה",
      petName:         "מיקה",
    });

    // All 4 rows still enqueued, with default (non-override) wording.
    expect(mockUpsert).toHaveBeenCalledTimes(4);
    const bookingCall = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "booking_confirmation");
    expect((bookingCall![0] as { body: string }).body).toContain("נקבע בהצלחה");
  });

  it("enqueueRescheduleNotification uses the clinic's reschedule_update override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { reschedule_update: "הועבר ל-{{newDate}}" } } },
      error: null,
    });

    await enqueueRescheduleNotification({
      appointmentId:    "appt-1",
      oldScheduledAt:   "2027-01-15T10:00:00.000Z",
      newScheduledAt:   "2027-01-20T12:00:00.000Z",
      durationMinutes:  30,
      visitType:        "home_visit",
      clinicId:         "clinic-1",
      customerId:       "cust-1",
      phone:            "+972500000000",
      customerName:     "דנה",
      petName:          "מיקה",
    });

    const [row] = mockUpsert.mock.calls[0] as [{ body: string }];
    expect(row.body).toContain("הועבר ל-");
  });

  it("enqueueClientCancellationConfirmation uses the clinic's override when present", async () => {
    mockSingle.mockResolvedValue({
      data: { settings: { smsTemplates: { client_cancellation_confirmation: "בוטל, {{customerName}}" } } },
      error: null,
    });

    await enqueueClientCancellationConfirmation({
      appointmentId: "appt-1",
      scheduledAt:   "2027-01-15T10:00:00.000Z",
      clinicId:      "clinic-1",
      customerId:    "cust-1",
      phone:         "+972500000000",
      customerName:  "דנה",
      petName:       "מיקה",
    });

    const call = mockUpsert.mock.calls.find(([row]) => (row as { type: string }).type === "client_cancellation_confirmation");
    expect((call![0] as { body: string }).body).toBe("בוטל, דנה");
  });
});
