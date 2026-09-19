import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NOTIFICATION_CLAIM_BATCH_SIZE, processNotifications } from "../../../src/lib/notificationProcessor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

vi.mock("../../../src/lib/sms.service.js", () => ({
  sendSms: vi.fn().mockResolvedValue({ sid: "SM_test" }),
}));

// Use real implementations so DST tests exercise actual Intl logic
vi.mock("../../../src/lib/notifications.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/notifications.js")>();
  return {
    ...actual,
    isQuietHours:     vi.fn(actual.isQuietHours),
    nextSendableTime: vi.fn(actual.nextSendableTime),
  };
});

import { sendSms } from "../../../src/lib/sms.service.js";
import { isQuietHours, nextSendableTime } from "../../../src/lib/notifications.js";

function makeRow(overrides: Partial<{
  id: string; phone: string; body: string; type: string;
  appointment_id: string; clinic_id: string;
}> = {}) {
  return {
    id:             "notif-1",
    phone:          "+972501234567",
    body:           "SMS text",
    type:           "booking_confirmation",
    appointment_id: "appt-1",
    clinic_id:      "clinic-1",
    ...overrides,
  };
}

/**
 * The processor makes one extra call between the stuck-row recovery pass and the
 * claim: the expiry sweep that closes out rows whose scheduled_for has long
 * passed. Tests that queue calls in order have to account for it.
 */
function expirySweep(rows: unknown[] = []) {
  return chainOf({ data: rows, error: null });
}

// A chainable mock that ends with .select().returns() or just resolves via .then()
/**
 * The second half of recovery: the sweep that closes out stale 'processing'
 * rows whose send was already attempted. It runs between the pending-reset and
 * the expiry sweep, so every ordered mock below has to account for it.
 */
function unresolvedSweep() {
  return chainOf({ data: [], error: null });
}

function chainOf(resolveValue: unknown = { error: null }) {
  const chain: Record<string, unknown> = {};
  const fn = vi.fn().mockReturnValue(chain);
  chain["update"]  = fn;
  chain["eq"]      = fn;
  chain["lte"]     = fn;
  chain["lt"]      = fn;
  chain["is"]      = fn;
  chain["not"]     = fn;
  chain["order"]   = fn;
  chain["limit"]   = fn;
  chain["select"]  = fn;
  chain["returns"] = vi.fn().mockResolvedValue(resolveValue);
  // Make chain awaitable for queries that don't call .returns()
  const originalThen = (res: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(res);
  (chain as { then?: unknown }).then = originalThen;
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isQuietHours).mockReturnValue(false);
  vi.mocked(sendSms).mockResolvedValue({ sid: "SM_test" });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("processNotifications", () => {
  it("returns zeros when claim returns no rows", async () => {
    // recovery call + claim call both succeed with no data
    const recovery = chainOf({ error: null });
    const claim    = chainOf({ data: [], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(unresolvedSweep()).mockReturnValueOnce(expirySweep()).mockReturnValueOnce(claim);

    const result = await processNotifications();
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, deferred: 0, expired: 0, remainingDue: 0 });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("atomically claims and sends SMS for each row", async () => {
    const rows = [makeRow({ id: "n-1" }), makeRow({ id: "n-2" })];

    const recovery   = chainOf({ error: null });
    const claim      = chainOf({ data: rows, error: null });
    const sentUpdate = chainOf({ error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expirySweep())
      .mockReturnValueOnce(claim)
      .mockReturnValue(sentUpdate);

    const result = await processNotifications({ appointmentId: "appt-1" });
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(sendSms).toHaveBeenCalledWith(rows[0]!.phone, rows[0]!.body);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(2);

    // M11: guarded on status='processing', not just id — so a concurrent
    // cancelFutureNotifications that already flipped the row to 'skipped'
    // makes this a no-op instead of clobbering it back to 'sent'.
    expect(sentUpdate.eq).toHaveBeenCalledWith("status", "processing");
  });

  it("bulk defers and tracks deferred count when in quiet hours", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);

    const recovery   = chainOf({ error: null });
    const deferChain = chainOf({ data: [{ id: "n-1" }, { id: "n-2" }], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(unresolvedSweep()).mockReturnValueOnce(expirySweep()).mockReturnValueOnce(deferChain);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.deferred).toBe(2);
    expect(result.sent).toBe(0);
  });

  it("marks row as failed and does not throw when sendSms rejects", async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new Error("Twilio error"));
    const row = makeRow();

    const recovery    = chainOf({ error: null });
    const claim       = chainOf({ data: [row], error: null });
    const failedUpdate = chainOf({ error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expirySweep())
      .mockReturnValueOnce(claim)
      .mockReturnValue(failedUpdate);

    const result = await processNotifications();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(failedUpdate.eq).toHaveBeenCalledWith("status", "processing");
  });

  it("logs error but still counts sent when post-send status update fails", async () => {
    const row = makeRow();
    const recovery      = chainOf({ error: null });
    const claim         = chainOf({ data: [row], error: null });
    // The attempt marker must succeed here — otherwise the send is skipped and
    // this stops being a test of the post-send path.
    const attemptMarker = chainOf({ error: null });
    const failUpdate    = chainOf({ error: { message: "DB error" } });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expirySweep())
      .mockReturnValueOnce(claim)
      .mockReturnValueOnce(attemptMarker)
      .mockReturnValue(failUpdate);

    // Should not throw; SMS was delivered
    const result = await processNotifications();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  // The duplicate-SMS window. Twilio's Messages API has no idempotency key, so
  // a row whose send was already attempted cannot be retried safely.
  it("stamps send_attempted_at before handing the row to Twilio", async () => {
    const row = makeRow();
    const recovery      = chainOf({ error: null });
    const claim         = chainOf({ data: [row], error: null });
    const attemptMarker = chainOf({ error: null });

    let markedBeforeSend = false;
    const markerUpdate = attemptMarker.update as ReturnType<typeof vi.fn>;
    vi.mocked(sendSms).mockImplementation(async () => {
      markedBeforeSend = markerUpdate.mock.calls.length > 0;
      return { sid: "SM_test" };
    });

    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expirySweep())
      .mockReturnValueOnce(claim)
      .mockReturnValueOnce(attemptMarker)
      .mockReturnValue(chainOf({ error: null }));

    await processNotifications();

    expect(markedBeforeSend).toBe(true);
    expect(attemptMarker.update).toHaveBeenCalledWith(
      expect.objectContaining({ send_attempted_at: expect.any(String) }),
    );
  });

  it("does not send when the attempt marker cannot be written", async () => {
    const row = makeRow();
    const recovery      = chainOf({ error: null });
    const claim         = chainOf({ data: [row], error: null });
    const attemptMarker = chainOf({ error: { message: "DB error" } });

    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expirySweep())
      .mockReturnValueOnce(claim)
      .mockReturnValueOnce(attemptMarker)
      .mockReturnValue(chainOf({ error: null }));

    const result = await processNotifications();

    // Sending without the marker would make a later crash indistinguishable
    // from a crash before the send, and the client would be texted twice.
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("second concurrent processor claims 0 rows (atomic guarantee)", async () => {
    // Simulates a second concurrent processor run: claim returns empty
    const recovery = chainOf({ error: null });
    const claim    = chainOf({ data: [], error: null });
    mockFrom.mockReturnValueOnce(recovery).mockReturnValueOnce(unresolvedSweep()).mockReturnValueOnce(expirySweep()).mockReturnValueOnce(claim);

    const result = await processNotifications();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  it("always scopes recovery/expiry/claim to clinic_id", async () => {
    const recovery = chainOf({ error: null });
    const unresolved = unresolvedSweep();
    const expiry = expirySweep();
    const claim = chainOf({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolved)
      .mockReturnValueOnce(expiry)
      .mockReturnValueOnce(claim);

    await processNotifications({ clinicId: "clinic-scoped" });

    expect(recovery.eq).toHaveBeenCalledWith("clinic_id", "clinic-scoped");
    expect(unresolved.eq).toHaveBeenCalledWith("clinic_id", "clinic-scoped");
    expect(expiry.eq).toHaveBeenCalledWith("clinic_id", "clinic-scoped");
    expect(claim.eq).toHaveBeenCalledWith("clinic_id", "clinic-scoped");
  });

  it("defaults clinic filter to AGENT_CLINIC_ID when clinicId is omitted", async () => {
    const recovery = chainOf({ error: null });
    const expiry = expirySweep();
    const claim = chainOf({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(recovery)
      .mockReturnValueOnce(unresolvedSweep())
      .mockReturnValueOnce(expiry)
      .mockReturnValueOnce(claim);

    await processNotifications();

    expect(claim.eq).toHaveBeenCalledWith("clinic_id", "00000000-0000-4000-8000-000000000001");
  });

  it("caps the atomic claim at NOTIFICATION_CLAIM_BATCH_SIZE and records remaining due rows", async () => {
    const rows = Array.from({ length: NOTIFICATION_CLAIM_BATCH_SIZE }, (_, i) =>
      makeRow({ id: `n-${i}` }),
    );
    const recovery = chainOf({ error: null });
    const claim = chainOf({ data: rows, error: null });
    const sentUpdate = chainOf({ error: null });
    const remaining = chainOf({ count: 17, error: null });

    let fromCalls = 0;
    mockFrom.mockImplementation(() => {
      fromCalls += 1;
      if (fromCalls === 1) return recovery;
      if (fromCalls === 2) return unresolvedSweep();
      if (fromCalls === 3) return expirySweep();
      if (fromCalls === 4) return claim;
      // claim + 50 attempt stamps + 50 sent updates + remaining count
      if (fromCalls === 4 + NOTIFICATION_CLAIM_BATCH_SIZE * 2 + 1) return remaining;
      return sentUpdate;
    });

    const result = await processNotifications({ clinicId: "clinic-1" });

    expect(claim.limit).toHaveBeenCalledWith(NOTIFICATION_CLAIM_BATCH_SIZE);
    expect(sendSms).toHaveBeenCalledTimes(NOTIFICATION_CLAIM_BATCH_SIZE);
    expect(result.processed).toBe(NOTIFICATION_CLAIM_BATCH_SIZE);
    expect(result.remainingDue).toBe(17);
    expect(remaining.eq).toHaveBeenCalledWith("clinic_id", "clinic-1");
  });
});

// ── DST correctness: quiet-hours deferral target is nextSendableTime() ──────
// Full DST correctness (morningReminderTime / nextSendableTime) is tested in
// notifications.test.ts. Here we only verify the processor passes the result
// through unchanged to scheduled_for.

describe("quiet-hours deferral — deferred target comes from nextSendableTime", () => {
  it("uses the value returned by nextSendableTime as scheduled_for", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);
    const target = new Date("2026-07-16T05:00:00Z"); // 08:00 Jerusalem July (UTC+3)
    vi.mocked(nextSendableTime).mockReturnValue(target);

    let capturedScheduledFor: string | null = null;
    mockFrom.mockReturnValue({
      update: vi.fn((fields: Record<string, string>) => {
        if (fields.scheduled_for) capturedScheduledFor = fields.scheduled_for;
        return chainOf({ data: [{ id: "n-1" }], error: null });
      }),
    });

    await processNotifications();

    expect(capturedScheduledFor).toBe(target.toISOString());
  });

  it("January: nextSendableTime returns 06:00 UTC → that is what gets stored", async () => {
    vi.mocked(isQuietHours).mockReturnValue(true);
    const target = new Date("2026-01-16T06:00:00Z"); // 08:00 Jerusalem Jan (UTC+2)
    vi.mocked(nextSendableTime).mockReturnValue(target);

    let capturedScheduledFor: string | null = null;
    mockFrom.mockReturnValue({
      update: vi.fn((fields: Record<string, string>) => {
        if (fields.scheduled_for) capturedScheduledFor = fields.scheduled_for;
        return chainOf({ data: [{ id: "n-1" }], error: null });
      }),
    });

    await processNotifications();

    expect(capturedScheduledFor).toBe("2026-01-16T06:00:00.000Z");
  });
});

// ── Stuck-row recovery ────────────────────────────────────────────────────────

describe("stuck-row recovery", () => {
  it("resets rows stuck in 'processing' older than 5 min back to pending", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-12T10:00:00Z") });

    let recoveryUpdate: Record<string, unknown> | null = null;
    // Both the recovery pass and the expiry sweep filter with .lt(), so the
    // threshold is recorded per update kind rather than into one variable that
    // the later call would overwrite.
    const ltByStatus: Record<string, string> = {};

    mockFrom.mockReturnValue({
      update: vi.fn((fields: Record<string, unknown>) => {
        const status = String(fields.status ?? "");
        const b: Record<string, unknown> = {};
        const self = () => b;
        b.eq = vi.fn(self);
        b.lt = vi.fn((_col: string, val: string) => {
          ltByStatus[status] = val;
          return chainOf({ data: [], error: null });
        });
        b.lte    = vi.fn(self);
        b.is     = vi.fn(self);
        b.not    = vi.fn(self);
        b.order  = vi.fn(self);
        b.limit  = vi.fn(self);
        b.select = vi.fn(self);
        b.returns = vi.fn(() => Promise.resolve({ data: [], error: null }));
        (b as { then?: unknown }).then = (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(res);
        if (status === "pending") recoveryUpdate = fields;
        return b;
      }),
    });

    await processNotifications();

    expect(recoveryUpdate).not.toBeNull();
    expect((recoveryUpdate as Record<string, unknown> | null)?.status).toBe("pending");

    // Threshold should be now − 5 minutes = 09:55 UTC
    expect(ltByStatus["pending"]).toBe("2026-06-12T09:55:00.000Z");
  });

  it("closes out pending rows overdue by more than 12 hours instead of sending them late", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-12T10:00:00Z") });

    let expiryUpdate: Record<string, unknown> | null = null;
    const ltByStatus: Record<string, string> = {};

    mockFrom.mockReturnValue({
      update: vi.fn((fields: Record<string, unknown>) => {
        const status = String(fields.status ?? "");
        const b: Record<string, unknown> = {};
        const self = () => b;
        b.eq = vi.fn(self);
        b.lt = vi.fn((_col: string, val: string) => {
          ltByStatus[status] = val;
          return chainOf({ data: [{ id: "stale-1" }, { id: "stale-2" }], error: null });
        });
        b.lte    = vi.fn(self);
        b.is     = vi.fn(self);
        b.not    = vi.fn(self);
        b.order  = vi.fn(self);
        b.limit  = vi.fn(self);
        b.select = vi.fn(self);
        b.returns = vi.fn(() => Promise.resolve({ data: [], error: null }));
        (b as { then?: unknown }).then = (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(res);
        if (status === "skipped") expiryUpdate = fields;
        return b;
      }),
    });

    const result = await processNotifications();

    // Marked skipped with a reason, not sent — a fortnight-old morning reminder
    // must never reach the client when the processor comes back up.
    expect(expiryUpdate).not.toBeNull();
    const expiryFields = expiryUpdate as Record<string, unknown> | null;
    expect(expiryFields?.status).toBe("skipped");
    expect(String(expiryFields?.error)).toContain("expired");
    expect(result.expired).toBe(2);
    expect(sendSms).not.toHaveBeenCalled();

    // Threshold is now − 12 hours = 22:00 the previous day.
    expect(ltByStatus["skipped"]).toBe("2026-06-11T22:00:00.000Z");
  });
});

