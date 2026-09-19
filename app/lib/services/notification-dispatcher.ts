/**
 * Asks the agent to process the SMS queue now.
 *
 * Queueing a row and waiting for pg_cron means the client's SMS lands up to 15
 * minutes after the vet approved the appointment — and the dashboard already
 * claims it was sent. The agent owns Twilio and the atomic-claim processor, so
 * the dashboard nudges it through the same job endpoint pg_cron calls rather
 * than growing a second sender.
 *
 * Best-effort by design: the row is queued either way, so a failure here delays
 * the SMS to the next cron tick, it does not lose it.
 */

export type DispatchTarget = { appointmentId?: string; clinicId?: string };
export type DispatchResult = { dispatched: boolean; reason?: string };

/** What POST /jobs/process-notifications reports back. */
type ProcessResult = {
  processed?: number;
  sent?: number;
  failed?: number;
  deferred?: number;
};

const DISPATCH_TIMEOUT_MS = 8_000;

export function getAgentJobsConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.AGENT_BASE_URL?.trim();
  const token = process.env.JOBS_BEARER_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

export class NotificationDispatcher {
  async dispatch(target: DispatchTarget): Promise<DispatchResult> {
    const config = getAgentJobsConfig();
    if (!config) {
      return { dispatched: false, reason: "AGENT_BASE_URL / JOBS_BEARER_TOKEN not configured" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.baseUrl}/jobs/process-notifications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(target),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { dispatched: false, reason: `agent returned ${response.status}` };
      }

      // A 200 only means the processor ran. It also answers 200 when Twilio
      // rejected the number, when quiet hours deferred the row, and when it
      // claimed nothing at all — reporting "sent" on any of those would put the
      // same false claim back in front of the vet that this whole change exists
      // to remove. Only an actual send counts.
      const result = (await response.json().catch(() => null)) as ProcessResult | null;
      if (!result || typeof result.sent !== "number") {
        return { dispatched: false, reason: "agent response was not readable" };
      }
      if (result.sent > 0) return { dispatched: true };
      if ((result.deferred ?? 0) > 0) {
        return { dispatched: false, reason: "deferred to after quiet hours" };
      }
      if ((result.failed ?? 0) > 0) {
        return { dispatched: false, reason: "the SMS provider rejected the message" };
      }
      return { dispatched: false, reason: "no matching message was queued" };
    } catch (error) {
      return {
        dispatched: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
