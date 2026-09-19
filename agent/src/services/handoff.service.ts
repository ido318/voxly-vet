import { isWithinBusinessHours } from "./triage.service.js";

export type HandoffDecision = {
  /** Whether the live call should be transferred to the human target now. */
  transfer: boolean;
  /** Whether an escalation should be recorded for Dana to follow up. */
  escalate: boolean;
  /** The E.164 number to transfer to (present only when transfer is true). */
  number?: string;
  /** Urgency to record on the escalation (present only when escalate is true). */
  urgency?: number;
  /** Hebrew message for Tomer to say to the caller. */
  result: string;
};

/**
 * Decide what to do when a caller asks for a human (or an emergency warrants it).
 *
 * Policy (per product decision): transfer to Dana's mobile ONLY during business
 * hours and only when a target number is configured. Otherwise record an
 * escalation and reassure the caller — never transfer to a line that won't be
 * answered.
 */
export function decideHumanHandoff(params: {
  now: Date;
  targetNumber?: string | null;
  emergency?: boolean;
}): HandoffDecision {
  const within = isWithinBusinessHours(params.now);

  if (within && params.targetNumber) {
    return {
      transfer: true,
      escalate: false,
      number: params.targetNumber,
      result: "מעביר אותך עכשיו לדנה, נא להישאר על הקו.",
    };
  }

  const urgency = params.emergency ? 8 : 6;
  return {
    transfer: false,
    escalate: true,
    urgency,
    result: within
      ? "רשמתי את הפנייה שלך ודנה תחזור אליך בהקדם."
      : "כרגע מחוץ לשעות הפעילות. רשמתי פנייה דחופה ודנה תחזור אליך בהקדם.",
  };
}
