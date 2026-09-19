// Single source of truth for Jerusalem-timezone math. Previously reimplemented
// independently in app/lib/israel-date.ts, app/lib/appointment-rules.ts,
// app/lib/services/dashboard-notifications.service.ts, agent/src/lib/notifications.ts,
// agent/src/lib/appointments.ts, and agent/src/services/triage.service.ts.

export const ISRAEL_TIMEZONE = "Asia/Jerusalem";

/** Israel-local calendar date (YYYY-MM-DD) for an instant. */
export function israelDateIso(instant: Date | string): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Israel-local {day (0=Sun..6=Sat), hour, minute} for an instant. */
export function israelDayHourMinute(instant: Date): { day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(instant);

  const DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  return { day: DAY_MAP[weekday] ?? 0, hour, minute };
}

/** Israel-local day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD date. */
export function israelDayOfWeek(dateIso: string): number {
  return israelDayHourMinute(new Date(israelLocalToUtcIso(dateIso, 12, 0))).day;
}

/**
 * Convert an Israel-local wall-clock instant (date + hour:minute) to an ISO
 * string carrying the correct seasonal offset (+02:00 winter / +03:00 summer).
 * Tries both and keeps whichever round-trips through Intl back to the same
 * local date/time — Israel's DST transition dates shift year to year, so this
 * can't be a fixed calendar rule.
 */
export function israelLocalToUtcIso(dateIso: string, hour: number, minute: number): string {
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  for (const offset of ["+02:00", "+03:00"]) {
    const candidate = new Date(`${dateIso}T${hhmm}:00${offset}`);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ISRAEL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const localDate = `${value("year")}-${value("month")}-${value("day")}`;
    const localTime = `${value("hour")}:${value("minute")}`;
    if (localDate === dateIso && localTime === hhmm) return `${dateIso}T${hhmm}:00${offset}`;
  }
  return `${dateIso}T${hhmm}:00+02:00`;
}

/** The UTC instant for a given hour:minute Israel-local wall-clock on dateIso. */
export function israelDateAtHour(dateIso: string, hour: number, minute = 0): Date {
  return new Date(israelLocalToUtcIso(dateIso, hour, minute));
}

/** [from, to) UTC ISO range covering a full Israel-local calendar day. */
export function israelDayUtcRange(dateIso: string): { from: string; to: string } {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid Israel date: ${dateIso}`);

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayIso = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;

  return {
    from: new Date(israelLocalToUtcIso(dateIso, 0, 0)).toISOString(),
    to: new Date(israelLocalToUtcIso(nextDayIso, 0, 0)).toISOString(),
  };
}

/** "HH:MM" (24h) in Israel local time. */
export function formatIsraelTime(instant: Date | string): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** "DD/MM/YY" in Israel local time. */
export function formatIsraelDate(instant: Date | string): string {
  const dateIso = israelDateIso(instant);
  const [year, month, day] = dateIso.split("-");
  if (!year || !month || !day) return dateIso;
  return `${day}/${month}/${year.slice(-2)}`;
}

/** "DD/MM/YY HH:MM" in Israel local time. */
export function formatIsraelDateTime(instant: Date | string): string {
  return `${formatIsraelDate(instant)} ${formatIsraelTime(instant)}`;
}

/**
 * {dayName, date, time} formatted in Hebrew for Israel local time — used by
 * SMS wording and spoken output. date is "D.M.YYYY" (not zero-padded),
 * distinct from formatIsraelDate's "DD/MM/YY" used in dashboard UI.
 */
export function formatAppointmentDateTime(instant: Date | string): {
  dayName: string;
  date: string;
  time: string;
} {
  const d = typeof instant === "string" ? new Date(instant) : instant;

  const dayName = new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TIMEZONE,
    weekday: "long",
  }).format(d);

  const { day, month, year } = new Intl.DateTimeFormat("he-IL", {
    timeZone: ISRAEL_TIMEZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const date = `${day}.${month}.${year}`;
  const time = formatIsraelTime(d);

  return { dayName, date, time };
}
