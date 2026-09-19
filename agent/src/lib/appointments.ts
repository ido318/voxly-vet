// Slot availability logic for Demo Vet Clinic clinic (Asia/Jerusalem).
import {
  ISRAEL_TIMEZONE,
  israelDateIso,
  israelDayOfWeek,
  israelLocalToUtcIso,
  israelDayHourMinute,
} from "@tomer/shared";

export type DayHours = {
  start: { h: number; m: number };
  end: { h: number; m: number };
};

export const VISIT_TYPE_VALUES = [
  "checkup",
  "home_visit",
  "vaccination",
  "phone_consultation",
  "neutering",
  "consultation",
  "urgent",
  "follow_up",
  "other",
] as const;

export type VisitType = (typeof VISIT_TYPE_VALUES)[number];

export type VisitTypeConfig = {
  durationMin: number;
  bufferMin: number;
  requiresApproval: boolean;
  labelHe: string;
};

// effectiveDuration = durationMin + bufferMin; stored in duration_minutes so
// the GIST constraint in the DB automatically enforces inter-appointment gaps.
// The table itself now lives in @tomer/shared; this workspace keeps the
// re-export so the ~40 local importers are unchanged. Two hand-maintained
// copies of the clinic's durations and Hebrew labels agreed only because
// nobody had edited one of them yet.
import { VISIT_TYPE_CONFIG } from "@tomer/shared";
export { VISIT_TYPE_CONFIG };

export function getVisitConfig(visitType: VisitType): VisitTypeConfig {
  return VISIT_TYPE_CONFIG[visitType] ?? VISIT_TYPE_CONFIG.other;
}

export function effectiveDuration(visitType: VisitType): number {
  const c = getVisitConfig(visitType);
  return c.durationMin + c.bufferMin;
}

// Sunday=0 … Friday=5 … Saturday=6 (JS Date.getDay())
const HOURS_BY_DAY: Record<number, DayHours | null> = {
  0: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Sunday
  1: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Monday
  2: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Tuesday
  3: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Wednesday
  4: { start: { h: 8, m:  0 }, end: { h: 20, m: 0 } }, // Thursday
  5: { start: { h: 8, m: 30 }, end: { h: 13, m: 0 } }, // Friday
  6: null,                                               // Saturday — closed
};

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const ISRAEL_TZ = ISRAEL_TIMEZONE;
const SLOT_GRANULARITY_MIN = 10; // GCD of 20, 30 — candidate start times every 10 min
const MAX_BOOKING_DAYS_AHEAD = 14;
const LATE_CANCEL_HOURS = 4;

export function getClinicHours(dateIso: string): DayHours | null {
  return HOURS_BY_DAY[israelDayOfWeek(dateIso)] ?? null;
}

export function getDayNameHe(dateIso: string): string {
  return HE_DAYS[israelDayOfWeek(dateIso)] ?? "";
}

/** Returns false if dateIso is more than 14 days from today (Israel time). */
export function isWithin14Days(dateIso: string): boolean {
  const now = new Date();
  const todayIso = toIsraelDateIso(now);
  const todayMs = new Date(toIso(todayIso, 0, 0)).getTime();
  const targetMs = new Date(toIso(dateIso, 0, 0)).getTime();
  const diffDays = (targetMs - todayMs) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= MAX_BOOKING_DAYS_AHEAD;
}

/**
 * Server-side booking/reschedule guard. checkAvailability already rejects
 * out-of-window and closed-day requests, but book/reschedule must not trust
 * that the LLM called it first.
 */
export function bookingWindowRejection(scheduledAt: string, visitType: VisitType): string | null {
  const instant = new Date(scheduledAt);
  if (Number.isNaN(instant.getTime())) {
    return "מועד התור אינו תקין.";
  }

  const dateIso = toIsraelDateIso(instant);
  if (!isWithin14Days(dateIso)) {
    return `ניתן לקבוע תורים עד ${formatDateHe(maxBookingDateIso())} בלבד (14 יום קדימה).`;
  }

  const hours = getClinicHours(dateIso);
  if (!hours) {
    return "המרפאה סגורה בשבת. אפשר לקבוע תור ביום ראשון עד חמישי 08:00-20:00 או ביום שישי 08:30-13:00.";
  }

  const { hour, minute } = israelDayHourMinute(instant);
  const startMin = hour * 60 + minute;
  const dayStartMin = hours.start.h * 60 + hours.start.m;
  const dayEndMin = hours.end.h * 60 + hours.end.m;
  const durationMin = effectiveDuration(visitType);
  if (startMin < dayStartMin || startMin + durationMin > dayEndMin) {
    return "השעה שנבחרה מחוץ לשעות הפעילות. אפשר לקבוע תור ביום ראשון עד חמישי 08:00-20:00 או ביום שישי 08:30-13:00.";
  }

  return null;
}

/** Returns true if cancelling now is within LATE_CANCEL_HOURS of the appointment. */
export function isTooLateToCancel(scheduledAtIso: string): boolean {
  const apptMs = new Date(scheduledAtIso).getTime();
  const nowMs = Date.now();
  const hoursUntil = (apptMs - nowMs) / (1000 * 60 * 60);
  return hoursUntil < LATE_CANCEL_HOURS;
}

/**
 * Returns the latest date (YYYY-MM-DD, Israel time) Tomer can book appointments for.
 * Used in responses like "אפשר לקבוע עד X".
 */
export function maxBookingDateIso(): string {
  const now = new Date();
  const ms = now.getTime() + MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  return toIsraelDateIso(new Date(ms));
}

export function toIsraelDateIso(d: Date): string {
  return israelDateIso(d);
}

/**
 * Generate candidate slot start times for a given day and visit type.
 * Granularity: SLOT_GRANULARITY_MIN (10 min).
 * A slot is valid if [start, start + effectiveDuration) fits within clinic hours.
 * Already-booked time ranges (as {start, end} pairs) are excluded.
 */
export function generateSlotsForVisitType(
  dateIso: string,
  hours: DayHours,
  visitType: VisitType,
  bookedRanges: Array<{ start: string; end: string }>,
): string[] {
  const durationMin = effectiveDuration(visitType);

  const dayStartMin = hours.start.h * 60 + hours.start.m;
  const dayEndMin   = hours.end.h   * 60 + hours.end.m;

  // Latest a slot can start: end of day minus the full effective duration
  const latestStartMin = dayEndMin - durationMin;

  const booked = bookedRanges.map((r) => ({
    startMs: new Date(r.start).getTime(),
    endMs:   new Date(r.end).getTime(),
  }));

  const candidateSlots: Array<{ iso: string; startMin: number }> = [];
  let cursor = Math.max(dayStartMin, earliestCandidateStartMin(dateIso));

  while (cursor <= latestStartMin) {
    const slotStartIso = toIso(dateIso, Math.floor(cursor / 60), cursor % 60);
    const slotStartMs = new Date(slotStartIso).getTime();
    const slotEndMs   = slotStartMs + durationMin * 60 * 1000;

    const overlaps = booked.some(
      (b) => slotStartMs < b.endMs && slotEndMs > b.startMs,
    );

    if (!overlaps) {
      candidateSlots.push({ iso: slotStartIso, startMin: cursor });
    }

    cursor += SLOT_GRANULARITY_MIN;
  }

  return candidateSlots.map((slot) => slot.iso);
}

/**
 * Format an ISO datetime as "HH:MM" in Israel local time.
 *
 * Timezone-aware (not a raw string slice): Supabase/PostgREST returns
 * `timestamptz` columns normalised to UTC, so a naive substring extraction
 * would report the wrong hour whenever the local offset isn't +00:00 (i.e.
 * always, for Israel). Always convert via the actual instant, never assume
 * the string's embedded offset is already Israel-local.
 */
export function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ISRAEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Format an ISO datetime as a natural spoken Israeli time, e.g. "1:00 בצהריים"
 * instead of the 24-hour "13:00" — a caller says "אחת בצהריים", never "שלוש עשרה".
 * Clinic hours are always 08:00-20:00, so there's no midnight ambiguity to handle.
 * Only for LLM-facing / spoken text — formatSlotLabel stays 24-hour for anything
 * that needs a sortable/comparable "HH:MM" string (e.g. internal tests).
 */
export function formatSlotSpokenHe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ISRAEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour24 = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = parts.find((p) => p.type === "minute")!.value;
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
  const suffix =
    hour24 < 12 ? "בבוקר" :
    hour24 < 14 ? "בצהריים" :
    hour24 < 18 ? "אחר הצהריים" :
    "בערב";
  return `${hour12}:${minute} ${suffix}`;
}

export function formatSlotOptionForTool(iso: string): string {
  return `${formatSlotSpokenHe(iso)} (scheduled_at=${iso})`;
}

export function formatDateHe(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

export function toIso(dateIso: string, hours: number, minutes: number): string {
  return israelLocalToUtcIso(dateIso, hours, minutes);
}

function earliestCandidateStartMin(dateIso: string): number {
  const now = new Date();
  if (toIsraelDateIso(now) !== dateIso) return 0;

  const { hour, minute } = israelDayHourMinute(now);
  const total = hour * 60 + minute;
  return Math.ceil(total / SLOT_GRANULARITY_MIN) * SLOT_GRANULARITY_MIN;
}
