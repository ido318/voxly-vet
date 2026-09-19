/**
 * Classify an ElevenLabs post-call webhook payload as 'operation' or 'information'.
 *
 * 'operation' = the call produced a tangible change (appointment booked/rescheduled/
 *               cancelled, waitlist entry, escalation created).
 * 'information' = the call was purely informational (availability check, general question, etc.).
 *
 * Strategy: look for operation-class tool calls inside the transcript's tool_calls array,
 * and also scan tool_results/metadata for known operation signals.
 */

export const VALID_CALL_CATEGORIES = new Set(["operation", "information"] as const);

const OPERATION_TOOL_NAMES = new Set([
  "book-appointment",
  "book_appointment",
  "bookAppointment",
  "cancel-or-reschedule",
  "cancel_or_reschedule",
  "cancelOrReschedule",
  "join-waitlist",
  "join_waitlist",
  "joinWaitlist",
  "escalate-to-vet",
  "escalate_to_vet",
  "escalateToNoa",
  "triage-pet-case",
  "triage_pet_case",
  "triagePetCase",
]);

type TranscriptItem = {
  role?: string;
  message?: string;
  tool_calls?: Array<{ tool_name?: string; type?: string; [k: string]: unknown }>;
  tool_results?: unknown[];
  [k: string]: unknown;
};

export function classifyCallCategory(
  payload: Record<string, unknown>,
): "operation" | "information" {
  const transcript = payload["transcript"];
  if (!Array.isArray(transcript)) return "information";

  for (const item of transcript as TranscriptItem[]) {
    const calls = item.tool_calls;
    if (!Array.isArray(calls)) continue;
    for (const call of calls) {
      const name = call["tool_name"] ?? call["type"] ?? "";
      if (typeof name === "string" && OPERATION_TOOL_NAMES.has(name)) {
        return "operation";
      }
    }
  }

  return "information";
}
