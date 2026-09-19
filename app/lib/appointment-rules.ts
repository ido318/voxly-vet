import type { AppointmentType } from "@/types/domain/appointment";
import { ISRAEL_TIMEZONE, israelDateIso, israelDayOfWeek, israelLocalToUtcIso, VISIT_TYPE_CONFIG } from "@tomer/shared";

export const CLINIC_TIMEZONE = ISRAEL_TIMEZONE;

export type VisitTypeConfig = {
  durationMin: number;
  bufferMin: number;
  requiresApproval: boolean;
  labelHe: string;
};

// Shared with the agent: two hand-maintained copies of the clinic's durations
// and Hebrew labels agreed only because nobody had edited one of them yet.
// Re-exported under the same name so existing importers are unchanged.
export { VISIT_TYPE_CONFIG };

export function effectiveDuration(type: AppointmentType): number {
  const config = VISIT_TYPE_CONFIG[type] ?? VISIT_TYPE_CONFIG.other;
  return config.durationMin + config.bufferMin;
}

export function isExpectedDuration(type: AppointmentType, durationMinutes: number): boolean {
  return durationMinutes === effectiveDuration(type);
}

export function getClinicHoursForDate(date: string): { open: string; close: string } | null {
  const weekday = israelDayOfWeek(date);
  if (weekday >= 0 && weekday <= 4) return { open: "08:00", close: "20:00" };
  if (weekday === 5) return { open: "08:30", close: "13:00" };
  return null;
}

export const BOOKING_WINDOW_DAYS = 14;

/**
 * Statuses that occupy a slot, so nothing else may be booked over them.
 *
 * Must stay identical to appointments_no_active_overlap's WHERE clause
 * (20260831102335_phase1_database_core_alignment.sql) and to the agent's list
 * in agent/src/lib/store.ts. calendar.service.ts used to carry its own shorter
 * copy that omitted checked_in and in_visit, so the dashboard offered a slot
 * overlapping a patient who was already in the room — and the booking then
 * failed on the exclusion constraint.
 */
export const SLOT_BLOCKING_STATUSES = [
  "scheduled",
  "confirmed",
  "pending_approval",
  "checked_in",
  "in_visit",
] as const;

export function occupiesSlot(status: string): boolean {
  return (SLOT_BLOCKING_STATUSES as readonly string[]).includes(status);
}

/**
 * `fromDate` must be an Israel-local YYYY-MM-DD (israelDateIso), not a UTC
 * one: between 21:00/22:00 Israel time and midnight UTC they differ, and the
 * caller would offer a date already in the past.
 */
export function getBookableDates(fromDate: string): string[] {
  const [year = 0, month = 1, day = 1] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Is an Israel-local YYYY-MM-DD inside the booking window: today through
 * BOOKING_WINDOW_DAYS - 1 days ahead, in Israel time?
 *
 * The 14-day rule is a binding clinic decision (CLAUDE.md), but until now it
 * only existed as a list of chips the wizard rendered. The API enforced
 * nothing: ?date=2027-06-01 returned real slots, and createAppointmentSchema
 * bounded neither end, so a date a year out or one in the past both validated.
 */
export function isWithinBookingWindow(dateIso: string, now = new Date()): boolean {
  const dates = getBookableDates(israelDateIso(now));
  return dates.includes(dateIso);
}

export function toIsraelLocalIso(date: string, hhmm: string): string {
  const [hourRaw, minuteRaw] = hhmm.split(":");
  return israelLocalToUtcIso(date, Number(hourRaw), Number(minuteRaw));
}
