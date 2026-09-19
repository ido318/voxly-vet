import { matchRedFlags as _matchRedFlags, type RedFlag } from "../triage/redFlagMatcher.js";
import { scoreUrgency as _scoreUrgency } from "../triage/urgencyScorer.js";
import { israelDayHourMinute } from "@tomer/shared";

export type { RedFlag };

export type TriageDecision =
  | "emergency_referral"    // urgency >= 8, any time
  | "urgent_callback"       // urgency 4-7, within business hours
  | "after_hours_referral"  // urgency 4-7, outside business hours
  | "routine";              // urgency < 4, or no flags + no time pressure

export type TriageResult = {
  decision: TriageDecision;
  urgency: number;
  matchedFlags: string[];       // flag ids
  withinBusinessHours: boolean;
};

// ── 4 fixed Hebrew scripts — wording approved by Dr. Dana. Do not change. ───

export const EMERGENCY_SCRIPT =
  'מצב החיה נשמע חירום רפואי. פנו עכשיו לבית חולים וטרינרי הפועל 24 שעות באזורכם — אל תמתינו.';

export const URGENT_CALLBACK_SCRIPT =
  'קיבלתי, אני מעביר את הפנייה לד"ר דנה עכשיו ומנסה למצוא לכם חלון לשיחה קצרה עוד היום. ' +
  'חשוב: אם המצב מחמיר בינתיים — פנו לבית חולים וטרינרי, אל תמתינו.';

export const AFTER_HOURS_SCRIPT =
  'המרפאה סגורה כרגע וד"ר דנה אינה זמינה. ' +
  'אני יכול לקחת פרטים ולקבוע תור או להעביר בקשה שדנה תחזור אליכם כשהמרפאה נפתחת. ' +
  'אם בינתיים מופיע קושי נשימה, התמוטטות, דימום שלא עוצר, חשד להרעלה, בטן נפוחה וקשה, או החמרה חדה — פנו מיד לבית חולים וטרינרי 24/7. ' +
  'רוצים שאבדוק תור קרוב אצל ד"ר דנה?';

export const ROUTINE_SCRIPT =
  'תודה שתיארתם. לא זיהיתי סימנים שמצריכים טיפול חירום, ואשמח לקבוע תור לבדיקה אצל ד"ר דנה — ' +
  'מתי נוח לכם? ואם משהו משתנה או מחמיר — התקשרו אלינו מיד.';

// ── Business-hours check (Asia/Jerusalem, DST-correct via Intl) ─────────────

/**
 * Returns true if `now` falls within Demo Vet Clinic business hours:
 * Sun–Thu 08:00–20:00, Fri 08:30–13:00, Sat closed.
 * All times in Asia/Jerusalem (DST-correct).
 */
export function isWithinBusinessHours(now: Date): boolean {
  const { day, hour, minute } = israelDayHourMinute(now);
  const totalMin = hour * 60 + minute;

  if (day >= 0 && day <= 4) {  // Sun–Thu
    return totalMin >= 8 * 60 && totalMin < 20 * 60;
  }
  if (day === 5) {  // Friday
    return totalMin >= 8 * 60 + 30 && totalMin < 13 * 60;
  }
  return false;  // Saturday
}

// ── Public re-exports for tests ──────────────────────────────────────────────

export function matchRedFlags(text: string): RedFlag[] {
  return _matchRedFlags(text);
}

export function scoreUrgency(flags: RedFlag[], durationHint?: string): number {
  return _scoreUrgency(flags, { durationHe: durationHint });
}

// ── Core decision ─────────────────────────────────────────────────────────────

export function decideTriage(input: { text: string; now: Date }): TriageResult {
  const { text, now } = input;

  const flags = _matchRedFlags(text);
  // Pass full text as duration hint so "פתאום"/"עכשיו" affect base score
  const urgency = _scoreUrgency(flags, { durationHe: text });
  const matchedFlags = flags.map((f) => f.id);
  const withinBusinessHours = isWithinBusinessHours(now);

  let decision: TriageDecision;
  if (urgency >= 8) {
    decision = "emergency_referral";
  } else if (urgency >= 4 && withinBusinessHours) {
    decision = "urgent_callback";
  } else if (urgency >= 4 && !withinBusinessHours) {
    decision = "after_hours_referral";
  } else {
    decision = "routine";
  }

  return { decision, urgency, matchedFlags, withinBusinessHours };
}
