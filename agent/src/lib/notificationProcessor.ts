import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import { logger } from "./logger.js";
import { sendSms } from "./sms.service.js";
import { isQuietHours, nextSendableTime } from "./notifications.js";

export const NOTIFICATION_CLAIM_BATCH_SIZE = 50;

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  deferred: number;
  /** Rows whose moment has passed; marked 'skipped' rather than sent late. */
  expired: number;
  /** Pending due rows left after this run's claim cap (0 when the batch was not full). */
  remainingDue: number;
};

type ProcessOptions = {
  appointmentId?: string;
  clinicId?: string;
};

type NotificationRow = {
  id: string;
  clinic_id: string;
  phone: string;
  body: string;
  type: string;
  appointment_id: string;
};

// Rows stuck in 'processing' for longer than this are considered crashed and reset.
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// A reminder is only useful near the moment it describes. If the processor was
// down — as it was for weeks while every cron run failed on a missing function —
// the backlog must not be delivered on recovery: nobody wants a "your
// appointment is today at 09:00" for an appointment two weeks past, and a
// post-visit follow-up that arrives a fortnight late reads as neglect. Anything
// overdue by more than this is closed out as 'skipped'.
const EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours

function applyJobFilters(
  // Supabase query builders are thenable and vary by method; keep this adapter untyped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  clinicId: string,
  appointmentId: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let next = query.eq("clinic_id", clinicId);
  if (appointmentId) next = next.eq("appointment_id", appointmentId);
  return next;
}

export async function processNotifications(opts: ProcessOptions = {}): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, deferred: 0, expired: 0, remainingDue: 0 };
  const now = new Date();
  const nowIso = now.toISOString();
  const clinicId = opts.clinicId ?? getEnv().AGENT_CLINIC_ID;

  // ── Recovery: rows stuck in 'processing' (crashed processor) ───────────
  //
  // Split by whether Twilio was already called. send_attempted_at is stamped
  // immediately before the send, so:
  //   - unset  -> we died before the send; nothing reached the client, retry.
  //   - set    -> the SMS may already have been delivered. Twilio's Messages
  //               API has no idempotency key, so a retry cannot be made a
  //               no-op at the provider. Close the row for a human instead:
  //               one row somebody checks beats a duplicate reminder to a
  //               client, which is what the old blanket reset produced.
  const staleThreshold = new Date(now.getTime() - PROCESSING_TIMEOUT_MS).toISOString();

  const { error: recoveryErr } = await applyJobFilters(
    getSupabase()
      .from("notifications_log")
      .update({ status: "pending", updated_at: nowIso })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold)
      .is("send_attempted_at", null),
    clinicId,
    opts.appointmentId,
  );
  if (recoveryErr) {
    logger.error({ error: recoveryErr.message }, "Stuck-row recovery failed — processing rows may remain stuck");
  }

  const { data: unresolved, error: unresolvedErr } = await applyJobFilters(
    getSupabase()
      .from("notifications_log")
      .update({
        status: "failed",
        error: "send outcome unknown: the processor stopped after handing the message to Twilio. Check Twilio before resending.",
        updated_at: nowIso,
      })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold)
      .not("send_attempted_at", "is", null)
      .select("id"),
    clinicId,
    opts.appointmentId,
  );
  if (unresolvedErr) {
    logger.error({ error: unresolvedErr.message }, "Unresolved-send sweep failed");
  } else if (unresolved && unresolved.length > 0) {
    const unresolvedRows = unresolved as Array<{ id: string }>;
    logger.error(
      { ids: unresolvedRows.map((row) => row.id) },
      "Notifications with an unknown send outcome — not retried, needs a human to check Twilio",
    );
  }

  // ── Expiry: close out rows whose moment has passed ─────────────────────
  const expiryThreshold = new Date(now.getTime() - EXPIRY_MS).toISOString();
  const expireQuery = applyJobFilters(
    getSupabase()
      .from("notifications_log")
      .update({ status: "skipped", error: "expired: scheduled_for passed by more than 12h", updated_at: nowIso })
      .eq("status", "pending")
      .lt("scheduled_for", expiryThreshold)
      .select("id"),
    clinicId,
    opts.appointmentId,
  );

  const { data: expired, error: expireErr } = await expireQuery;
  if (expireErr) {
    logger.error({ error: expireErr.message }, "Expiry sweep failed — stale rows may be sent late");
  } else if (expired && expired.length > 0) {
    result.expired = expired.length;
    logger.warn({ expired: expired.length }, "Skipped notifications whose scheduled time had passed");
  }

  // ── Quiet hours: bulk defer all pending rows ───────────────────────────
  if (isQuietHours(now)) {
    const deferUntil = nextSendableTime(now).toISOString();
    const deferQuery = applyJobFilters(
      getSupabase()
        .from("notifications_log")
        .update({ scheduled_for: deferUntil, updated_at: nowIso })
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
        .select("id"),
      clinicId,
      opts.appointmentId,
    );

    const { data: deferred, error: deferErr } = await deferQuery;
    if (deferErr) {
      logger.error({ error: deferErr.message }, "Bulk defer failed");
    } else {
      result.deferred = deferred?.length ?? 0;
    }
    return result;
  }

  // ── Atomic claim: UPDATE status='processing' RETURNING * ───────────────
  // PostgreSQL evaluates the WHERE and UPDATE atomically; two concurrent
  // processors will each claim a disjoint set of rows. Cap the batch so a
  // backlog cannot monopolise one cron tick / Twilio budget.
  const claimQuery = applyJobFilters(
    getSupabase()
      .from("notifications_log")
      .update({ status: "processing", updated_at: nowIso })
      .eq("status", "pending")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(NOTIFICATION_CLAIM_BATCH_SIZE)
      .select("id, clinic_id, phone, body, type, appointment_id"),
    clinicId,
    opts.appointmentId,
  );

  const { data: claimed, error: claimErr } = await claimQuery;
  if (claimErr) throw new Error(`processNotifications claim failed: ${claimErr.message}`);
  const rows = (claimed ?? []) as NotificationRow[];
  if (rows.length === 0) return result;

  for (const row of rows) {
    result.processed++;
    try {
      // Record the attempt before making it. If the process dies during the
      // send, this is the only evidence that the client may already have the
      // message — recovery above reads exactly this.
      const { error: attemptErr } = await getSupabase()
        .from("notifications_log")
        .update({ send_attempted_at: nowIso, updated_at: nowIso })
        .eq("id", row.id)
        .eq("status", "processing");
      if (attemptErr) {
        // Without the marker a crash mid-send would look like a crash before
        // it, and the client would get the message twice. Skip rather than
        // send blind; the row stays claimed and the sweep resolves it.
        logger.error(
          { id: row.id, error: attemptErr.message },
          "Could not record send attempt — not sending, to avoid an untraceable duplicate",
        );
        result.failed++;
        continue;
      }

      const { sid } = await sendSms(row.phone, row.body);

      // Guarded on status='processing' (not just id) so a cancelFutureNotifications
      // call that raced this send and already flipped the row to 'skipped'
      // isn't silently clobbered back to 'sent' — it's a no-op instead.
      const { error: sentErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "sent", sent_at: nowIso, twilio_message_sid: sid, updated_at: nowIso })
        .eq("id", row.id)
        .eq("status", "processing");

      if (sentErr) {
        // SMS was delivered but we failed to record it. The 5-min recovery
        // will reset this row to 'pending', risking a duplicate send. Log at
        // error level so on-call can investigate.
        logger.error(
          { id: row.id, error: sentErr.message },
          "SMS delivered but status update to 'sent' failed — row will recover in 5 min",
        );
      }
      result.sent++;
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error({ id: row.id, type: row.type, error: message }, "Failed to send SMS");

      // Same guard as the 'sent' update above.
      const { error: failedErr } = await getSupabase()
        .from("notifications_log")
        .update({ status: "failed", error: message, updated_at: nowIso })
        .eq("id", row.id)
        .eq("status", "processing");

      if (failedErr) {
        logger.error(
          { id: row.id, error: failedErr.message },
          "SMS failed but status update to 'failed' failed — row will recover in 5 min",
        );
      }
      result.failed++;
    }
  }

  if (rows.length >= NOTIFICATION_CLAIM_BATCH_SIZE) {
    const remainingQuery = applyJobFilters(
      getSupabase()
        .from("notifications_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lte("scheduled_for", nowIso),
      clinicId,
      opts.appointmentId,
    );
    const { count, error: remainingErr } = await remainingQuery;
    if (remainingErr) {
      logger.error({ error: remainingErr.message }, "Failed to count remaining due notifications after batch cap");
    } else {
      result.remainingDue = count ?? 0;
      if (result.remainingDue > 0) {
        logger.warn(
          { remainingDue: result.remainingDue, claimed: rows.length, clinicId },
          "processNotifications: more due rows remain after batch cap",
        );
      }
    }
  }

  return result;
}
