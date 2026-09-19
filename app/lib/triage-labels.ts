/**
 * Hebrew labels for the triage decisions and red flags the agent records on an
 * escalation.
 *
 * The agent writes `escalations.reason` as one composite English string:
 *
 *   triage: urgent_callback — flags: breathing_difficulty — "הכלב לא נושם טוב"
 *
 * That is fine as a stored record but reads as raw machine output on a Hebrew
 * screen, so it is parsed and re-rendered here rather than changed at the
 * source — which also covers escalations already in the database.
 *
 * RED_FLAG_LABELS mirrors `agent/src/knowledge/red-flags.ts`, whose wording is
 * approved by Dr. Dana and frozen. The two workspaces cannot import from each
 * other, so `tests/unit/triage-labels.test.ts` reads that file directly and
 * fails if the two ever drift apart. Do not edit these strings here — change
 * the agent's list (with approval) and this follows.
 */

export const TRIAGE_DECISION_LABELS: Record<string, string> = {
  emergency_referral: "הפניה לחירום",
  urgent_callback: "חזרה דחופה",
  after_hours_referral: "פנייה מחוץ לשעות",
  routine: "שגרתי",
};

export const RED_FLAG_LABELS: Record<string, string> = {
  breathing_difficulty: "קושי נשימה",
  unconsciousness_collapse: "חוסר הכרה / קריסה",
  seizures: "פרכוסים",
  significant_bleeding: "דימום משמעותי",
  suspected_poisoning: "חשד הרעלה",
  severe_trauma: "טראומה קשה",
  abdominal_swelling_gdv: "נפיחות בטן (GDV)",
  cat_not_urinating: "חתול שלא מטיל שתן",
  vomiting_blood: "הקאה עם דם",
  extreme_pain: "כאב קיצוני",
  heat_stroke: "מכת חום",
  deep_open_wound: "פצע פתוח עמוק",
  eye_injury: "פציעת עיניים / אובדן ראייה",
  dystocia: "יילוד תקוע (דיסטוציה)",
  animal_attack: "תקיפה על ידי חיה",
  snake_bite: "הכשת נחש",
};

export type ParsedEscalationReason = {
  /** Hebrew decision label, when the reason came from the triage engine. */
  decision: string | null;
  /** Hebrew red-flag names; empty when the engine matched none. */
  flags: string[];
  /** What the caller actually said — the part worth reading first. */
  quote: string | null;
  /** Anything that did not parse, passed through unchanged. */
  raw: string;
};

// triage: <decision> — flags: <a, b|none> — "<quote>"
const TRIAGE_REASON = /^triage:\s*([a-z_]+)\s*—\s*flags:\s*([^—]*?)\s*(?:—\s*"([\s\S]*)")?$/;

/**
 * Splits a triage-authored reason into its parts. A reason written by anything
 * else (a human note, an older format) passes straight through as `raw`, so no
 * escalation can be rendered blank.
 */
export function parseEscalationReason(reason: string): ParsedEscalationReason {
  const trimmed = reason?.trim() ?? "";
  const match = TRIAGE_REASON.exec(trimmed);

  if (!match) {
    return { decision: null, flags: [], quote: null, raw: trimmed };
  }

  const [, decision, flagList, quote] = match;
  if (!decision) {
    return { decision: null, flags: [], quote: null, raw: trimmed };
  }

  const flags =
    flagList && flagList !== "none"
      ? flagList
          .split(",")
          .map((flag) => flag.trim())
          .filter(Boolean)
          .map((flag) => RED_FLAG_LABELS[flag] ?? flag)
      : [];

  return {
    decision: TRIAGE_DECISION_LABELS[decision] ?? decision,
    flags,
    quote: quote?.trim() || null,
    raw: trimmed,
  };
}

/** One-line Hebrew rendering, for rows too tight for the structured form. */
export function formatEscalationReason(reason: string): string {
  const { decision, flags, quote, raw } = parseEscalationReason(reason);
  if (!decision) return raw;

  const head = flags.length ? `${decision} · ${flags.join(", ")}` : decision;
  return quote ? `${head} — ${quote}` : head;
}
