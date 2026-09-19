"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input } from "@/components/dashboard/ui/field";
import { Alert } from "@/components/dashboard/ui/alert";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { AnimalIcon, ChevLeftIcon, ChevRightIcon, CalendarIcon, PlusIcon } from "@/components/dashboard/icons";
import { toIsraelLocalIso, VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";
import { ISRAEL_TIMEZONE, israelDateIso } from "@/lib/israel-date";
import { AppointmentDrawer } from "@/app/dashboard/calendar/appointment-drawer";
import { NewAppointmentWizard } from "@/app/dashboard/calendar/new-appointment-wizard";
import { useSearchParams } from "next/navigation";
import type { MeResponse } from "@/types/api/me";
import type { Appointment } from "@/types/domain/appointment";
import type { CalendarBlock } from "@/types/domain/calendar-block";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = ISRAEL_TIMEZONE;
const HOUR_START = 8;
const HOUR_END   = 20;
const HOUR_SPAN  = HOUR_END - HOUR_START;
const HOUR_HEIGHT_PX = 150;
const TIMELINE_HEIGHT_PX = HOUR_SPAN * HOUR_HEIGHT_PX;

// Matches the hour-gutter (`w-16`) + per-day (`min-w-[156px]`) widths below —
// used only to give the shared horizontal-scroll wrapper an explicit min-width
// so the day-header row and the hour grid stay pixel-aligned while scrolling.
const HOUR_GUTTER_WIDTH_PX = 64;
const DAY_COLUMN_MIN_WIDTH_PX = 156;
const WEEK_GRID_MIN_WIDTH_PX = HOUR_GUTTER_WIDTH_PX + DAY_COLUMN_MIN_WIDTH_PX * 7;

// Days: Sun(0)=א, Mon(1)=ב, Tue(2)=ג, Wed(3)=ד, Thu(4)=ה, Fri(5)=ו
const HE_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function isoOfDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function weekStartSun(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function israelHour(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date(iso));
  return {
    h: parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10),
    m: parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10),
  };
}

function topPx(iso: string) {
  const { h, m } = israelHour(iso);
  return ((h * 60 + m - HOUR_START * 60) / 60) * HOUR_HEIGHT_PX;
}

function heightPx(minutes: number) {
  return (minutes / 60) * HOUR_HEIGHT_PX;
}

function minutesBetween(startIso: string, endIso: string) {
  return Math.max(10, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

function calendarBlockErrorMessage(payload: {
  error?: { code?: string; message?: string };
} | null) {
  if (payload?.error?.code === "VALIDATION_ERROR") {
    return "בדקו שהתאריך והשעות תקינים וששעת הסיום אחרי שעת ההתחלה.";
  }
  return payload?.error?.message ?? "שמירת החסימה נכשלה";
}

function apiErrorMessage(
  payload: { error?: { message?: string } } | null,
  fallback: string,
) {
  return payload?.error?.message ?? fallback;
}

function fmtWeekRange(start: Date, end: Date) {
  const startText = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "long" }).format(start);
  const endText = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(end);
  return `${startText} - ${endText}`;
}

/**
 * A block is a white sheet with a hairline and a 2px type-coloured edge —
 * colour appears only where it changes a decision, so no coloured region
 * background larger than a chip. The 12 source keys sit on the four hues.
 */
const VISIT_MARK: Record<string, string> = {
  checkup: "var(--type-checkup)",
  consultation: "var(--type-consultation)",
  vaccination: "var(--type-vaccination)",
  vaccine: "var(--type-vaccination)",
  surgery: "var(--type-surgery)",
  neutering: "var(--type-neutering)",
  urgent: "var(--type-urgent)",
  home_visit: "var(--type-home-visit)",
  phone_consultation: "var(--type-phone-consultation)",
  follow_up: "var(--type-follow-up)",
  followup: "var(--type-follow-up)",
  other: "var(--type-other)",
};

const CALENDAR_LEGEND: Array<{ label: string; color: string }> = [
  { label: "בדיקה וייעוץ", color: "var(--type-checkup)" },
  { label: "חיסון וייעוץ טלפוני", color: "var(--type-vaccination)" },
  { label: "ניתוח ועיקור", color: "var(--type-surgery)" },
  { label: "מעקב", color: "var(--type-follow-up)" },
  { label: "ביקור בית", color: "var(--type-home-visit)" },
];

// A couple of legacy aliases ("vaccine", "followup") can still exist on older rows written
// before the appointment_type enum was tightened to VISIT_TYPE_CONFIG's canonical set —
// same aliases type-pill.tsx already accounts for.
const LEGACY_TYPE_ALIASES: Record<string, keyof typeof VISIT_TYPE_CONFIG> = {
  vaccine: "vaccination",
  followup: "follow_up",
};

function visitLabel(type: string) {
  const canonical = LEGACY_TYPE_ALIASES[type] ?? (type as keyof typeof VISIT_TYPE_CONFIG);
  return VISIT_TYPE_CONFIG[canonical]?.labelHe ?? type;
}

function typeMark(type: string) {
  return VISIT_MARK[type] ?? VISIT_MARK.other;
}

function appointmentTime(iso: string) {
  const { h, m } = israelHour(iso);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Week columns ──────────────────────────────────────────────────────────────

function ApptBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const top  = topPx(appt.scheduledAt);
  const h    = heightPx(appt.durationMinutes);
  const mark = typeMark(appt.appointmentType);
  const pending = appt.status === "pending_approval";
  const petName = appt.petName ?? "חיה";
  const customerName = appt.customerName ?? "לקוח";
  const title = `${petName} · ${customerName} · ${visitLabel(appt.appointmentType)}`;

  // The stored duration is "effective" (real visit time + trailing buffer —
  // see VISIT_TYPE_CONFIG in lib/appointment-rules.ts), so split the block
  // visually: the buffer tail renders with --hatch, the same texture
  // CalendarBlockOverlay already uses below for "not actually occupied" time.
  const canonicalType = LEGACY_TYPE_ALIASES[appt.appointmentType] ?? (appt.appointmentType as keyof typeof VISIT_TYPE_CONFIG);
  const visitMinutes = VISIT_TYPE_CONFIG[canonicalType]?.durationMin ?? appt.durationMinutes;
  const bufferMinutes = Math.max(0, appt.durationMinutes - visitMinutes);
  const bufferHeightPx = bufferMinutes > 0 ? heightPx(bufferMinutes) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-x-2 z-10 overflow-hidden px-2 py-1.5 text-start text-[12px]"
      style={{
        top: `${top}px`,
        height: `${Math.max(h, 72)}px`,
        minHeight: "72px",
        background: "var(--surface-raised)",
        borderRadius: "var(--radius-1)",
        border: "1px solid var(--border-row)",
        borderStyle: pending ? "dashed" : "solid",
        borderInlineStart: `2px solid ${mark}`,
        borderInlineStartStyle: "solid",
        color: "var(--text-primary)",
        boxShadow: "var(--shadow-hairline)",
        transition: "var(--transition-color)",
      }}
      title={title}
    >
      {bufferMinutes > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: `${bufferHeightPx}px`, background: "var(--hatch)" }}
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight">{petName}</div>
            <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{customerName}</div>
          </div>
          <AnimalIcon species={appt.petSpecies ?? "dog"} size={16} className="mt-0.5 flex-shrink-0 text-[var(--text-faint)]" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="truncate">{visitLabel(appt.appointmentType)}</span>
          <span className="gv-data shrink-0">{appointmentTime(appt.scheduledAt)}</span>
        </div>
        {pending && (
          <div className="mt-1 text-[10px]" style={{ color: "var(--status-pending-text)", fontWeight: "var(--w-semibold)" }}>
            ממתין לאישור
          </div>
        )}
      </div>
    </button>
  );
}

function CalendarBlockOverlay({
  block,
  onDelete,
}: {
  block: CalendarBlock;
  onDelete: (blockId: string) => void;
}) {
  const top = topPx(block.startAt);
  const h = heightPx(minutesBetween(block.startAt, block.endAt));

  return (
    <div
      className="absolute inset-x-[2px] overflow-hidden px-2 py-1.5 text-[10px]"
      style={{
        background: "var(--hatch)",
        borderRadius: "var(--radius-1)",
        border: "1px solid var(--border-row)",
        color: "var(--text-faint)",
        top: `${Math.max(0, top)}px`,
        height: `${Math.max(h, 48)}px`,
        minHeight: "26px",
      }}
      title={block.reason ?? "חסימת יומן"}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-[var(--text-secondary)]">חסום</span>
        <button
          type="button"
          className="rounded px-1 text-[9px] text-[var(--status-critical-text)] hover:bg-[var(--status-critical-wash)]"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(block.id);
          }}
        >
          מחק
        </button>
      </div>
      {block.reason && <div className="truncate">{block.reason}</div>}
    </div>
  );
}

function DayColumn({
  day,
  appointments,
  blocks,
  isToday,
  onDeleteBlock,
  onSelectAppointment,
}: {
  day: Date;
  appointments: Appointment[];
  blocks: CalendarBlock[];
  isToday: boolean;
  onDeleteBlock: (blockId: string) => void;
  onSelectAppointment: (appt: Appointment) => void;
}) {
  const isFriday = day.getDay() === 5;
  const isSaturday = day.getDay() === 6;
  const friEnd = ((13 * 60 + 0 - HOUR_START * 60) / 60) * HOUR_HEIGHT_PX;

  if (isSaturday) {
    return (
      <div className="relative min-w-[156px] flex-1 border-s border-[var(--border-hairline)] bg-[var(--surface-sunken)]">
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <span className="text-xs text-[var(--text-faint)]">סגור</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "relative min-w-[156px] flex-1 border-s border-[var(--border-hairline)]",
        isToday ? "bg-white" : "bg-white",
      ].join(" ")}
    >
      {/* Hour gridlines */}
      {Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START).map(h => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-[var(--border-row)]"
          style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT_PX}px` }}
        />
      ))}

      {/* Friday closed-after marker */}
      {isFriday && (
        <div
          className="absolute inset-x-0 bottom-0 bg-[var(--surface-canvas)] opacity-60"
          style={{ top: `${friEnd}px` }}
        />
      )}

      {/* Appointments */}
      {blocks.map(block => (
        <CalendarBlockOverlay key={block.id} block={block} onDelete={onDeleteBlock} />
      ))}

      {appointments.map(appt => (
        <ApptBlock key={appt.id} appt={appt} onClick={() => onSelectAppointment(appt)} />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = isoOfDate(new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartSun(today));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState(false);
  const [blockDate, setBlockDate] = useState(today);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("20:00");
  const [blockReason, setBlockReason] = useState("סיום מוקדם");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const searchParams = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(() => searchParams.get("newAppointment") === "1");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) as [Date, Date, Date, Date, Date, Date, Date],
    [weekStart],
  );
  const weekEnd = weekDays[6];
  const from = isoOfDate(weekStart);
  const to   = isoOfDate(weekEnd);

  const fetchData = useCallback(async (options: { background?: boolean } = {}) => {
    if (!options.background) setLoading(true);
    try {
      setCalendarError(null);
      const rangeStart = toIsraelLocalIso(from, "00:00");
      const rangeEnd = toIsraelLocalIso(to, "23:59");

      const meRes = await fetch("/api/me");
      if (!meRes.ok) {
        const payload = await meRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת פרטי המשתמש נכשלה."));
      }

      const me = await meRes.json() as { data: MeResponse };
      const activeClinicId = me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null;
      setClinicId(activeClinicId);
      if (!activeClinicId) {
        throw new Error("לא נמצאה מרפאה פעילה למשתמש.");
      }

      const [calendarRes, blockRes] = await Promise.all([
        fetch(`/api/calendar?clinicId=${encodeURIComponent(activeClinicId)}&view=week&date=${encodeURIComponent(from)}`),
        fetch(`/api/calendar-blocks?from=${encodeURIComponent(rangeStart)}&to=${encodeURIComponent(rangeEnd)}`),
      ]);

      if (!calendarRes.ok) {
        const payload = await calendarRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת התורים ליומן נכשלה."));
      }

      if (!blockRes.ok) {
        const payload = await blockRes.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(apiErrorMessage(payload, "טעינת חסימות היומן נכשלה."));
      }

      const calendarData = await calendarRes.json() as { data: { items: Appointment[] } };
      const blockData = await blockRes.json() as { data: { items: CalendarBlock[] } };
      setAppointments(calendarData.data.items ?? []);
      setBlocks(blockData.data.items ?? []);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "טעינת היומן נכשלה.");
    } finally {
      if (!options.background) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchData({ background: true });
    }, 5000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchData({ background: true });
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchData]);

  function apptForDay(d: Date) {
    const iso = isoOfDate(d);
    return appointments.filter(a => israelDateIso(a.scheduledAt) === iso);
  }

  function blocksForDay(d: Date) {
    const iso = isoOfDate(d);
    return blocks.filter(block => israelDateIso(block.startAt) === iso || israelDateIso(block.endAt) === iso);
  }

  async function createBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinicId) {
      setBlockError("לא נמצאה מרפאה פעילה למשתמש.");
      return;
    }

    setSavingBlock(true);
    setBlockError(null);
    try {
      const startAt = toIsraelLocalIso(blockDate, blockStart);
      const endAt = toIsraelLocalIso(blockDate, blockEnd);
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        setBlockError("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
        return;
      }

      const res = await fetch("/api/calendar-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          startAt,
          endAt,
          reason: blockReason.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as {
          error?: { code?: string; message?: string };
        } | null;
        throw new Error(calendarBlockErrorMessage(payload));
      }

      await fetchData();
    } catch (error) {
      setBlockError(error instanceof Error ? error.message : "שמירת החסימה נכשלה");
    } finally {
      setSavingBlock(false);
    }
  }

  async function deleteBlock(blockId: string) {
    setCalendarError(null);
    try {
      const res = await fetch(`/api/calendar-blocks/${blockId}`, { method: "DELETE" });
      if (res.ok) {
        setBlocks(current => current.filter(block => block.id !== blockId));
        return;
      }
      const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      setCalendarError(apiErrorMessage(payload, "מחיקת החסימה נכשלה."));
    } catch {
      setCalendarError("מחיקת החסימה נכשלה.");
    }
  }

  const pendingCount = appointments.filter(a => a.status === "pending_approval").length;
  const HOURS = Array.from({ length: HOUR_SPAN + 1 }, (_, i) => i + HOUR_START);
  const weekRange = fmtWeekRange(weekStart, weekEnd);

  return (
    <div className="min-h-full bg-[var(--surface-canvas)] p-6">
      <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">יומן</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
            {weekRange} · בחרו תור כדי לשנות מועד
          </p>
          {pendingCount > 0 && (
            <Badge tone="pending" dot className="mt-2">
              {pendingCount} ממתין{pendingCount > 1 ? "ים" : ""} לאישור
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-2)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-raised)] transition-all"
          >
            <PlusIcon size={15} />
            תור חדש
          </button>
          <div className="flex h-10 items-center overflow-hidden rounded-[var(--radius-2)] bg-[var(--surface-raised)] shadow-[var(--shadow-raised)]">
            <button
              type="button"
              className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevRightIcon size={14} />
            </button>
            <span className="min-w-[112px] border-x border-[var(--border-hairline)] px-4 text-center text-sm font-semibold text-[var(--text-primary)]">
              השבוע
            </span>
            <button
              type="button"
              className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevLeftIcon size={14} />
            </button>
          </div>
          <Btn variant="soft" size="md" className="h-10" onClick={() => setWeekStart(weekStartSun(today))}>
            היום
          </Btn>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">חסימת יומן</h2>
            <p className="text-xs text-[var(--text-muted)]">חסום שעות שבהן דנה לא זמינה. תומר לא יציע תורים בטווחים האלה.</p>
          </div>
          <Badge tone="neutral">{blocks.length} חסימות השבוע</Badge>
        </div>

        <form className="grid items-end gap-2 md:grid-cols-[1fr_120px_120px_1.4fr_auto]" onSubmit={createBlock}>
          <Field label="תאריך" htmlFor="block-date">
            <Input
              id="block-date"
              type="date"
              value={blockDate}
              onChange={(event) => setBlockDate(event.target.value)}
              className="h-9"
              required
            />
          </Field>
          <Field label="משעה" htmlFor="block-start">
            <Input
              id="block-start"
              type="time"
              value={blockStart}
              onChange={(event) => setBlockStart(event.target.value)}
              className="h-9"
              required
            />
          </Field>
          <Field label="עד שעה" htmlFor="block-end">
            <Input
              id="block-end"
              type="time"
              value={blockEnd}
              onChange={(event) => setBlockEnd(event.target.value)}
              className="h-9"
              required
            />
          </Field>
          <Field label="סיבה" htmlFor="block-reason">
            <Input
              id="block-reason"
              type="text"
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="סיבה"
              className="h-9"
            />
          </Field>
          <Btn type="submit" size="sm" loading={savingBlock}>חסום</Btn>
        </form>

        {blockError && <p className="text-xs font-semibold text-[var(--status-critical-text)]">{blockError}</p>}
      </Card>

      {calendarError && <Alert tone="critical">{calendarError}</Alert>}

      {loading ? (
        <Skeleton className="h-[560px]" />
      ) : (
        <Card noPad className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-white px-6 py-4">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[var(--text-muted)]">
              {CALENDAR_LEGEND.map(({ label, color }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {appointments.length} תורים השבוע
            </span>
          </div>

          {/* Shared horizontal scroll: the day-header row and the hour grid below share
              one scrollbar so they can never drift out of column alignment, and this
              stays contained in its own box instead of forcing the whole page to
              scroll sideways on narrower laptop widths. */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${WEEK_GRID_MIN_WIDTH_PX}px` }}>
              <div className="flex border-b border-[var(--border-hairline)] bg-white">
                <div className="w-16 flex-shrink-0" />
                {weekDays.map((day, i) => {
                  const isToday = isoOfDate(day) === today;
                  const isSat   = day.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={[
                        "min-w-[156px] flex-1 border-s border-[var(--border-row)] py-3 text-center",
                        isToday ? "bg-[var(--active-wash)] text-[var(--text-accent)]" : "text-[var(--text-secondary)]",
                        isSat ? "text-[var(--text-faint)]" : "",
                      ].join(" ")}
                    >
                      <div className="text-[12px] font-semibold">{HE_DAYS[day.getDay()]}</div>
                      <div className="mt-0.5 text-[22px] font-semibold leading-none">{new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "2-digit" }).format(day)}</div>
                    </div>
                  );
                })}
              </div>

              <div
                className="flex bg-white"
                style={{ height: `${TIMELINE_HEIGHT_PX}px` }}
              >
                <div className="relative w-16 flex-shrink-0 bg-white">
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute w-16 pe-3 text-end text-[11px] font-semibold leading-none text-[var(--text-muted)]"
                      style={{
                        top: `${(h - HOUR_START) * HOUR_HEIGHT_PX}px`,
                        transform: "translateY(-50%)",
                        height: `${HOUR_HEIGHT_PX}px`,
                      }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                <div className="relative flex h-full flex-1">
                  {weekDays.map((day, i) => (
                    <DayColumn
                      key={i}
                      day={day}
                      appointments={apptForDay(day)}
                      blocks={blocksForDay(day)}
                      isToday={isoOfDate(day) === today}
                      onDeleteBlock={deleteBlock}
                      onSelectAppointment={setSelectedAppointment}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state (no appointments at all) */}
      {!loading && appointments.length === 0 && (
        <EmptyState
          icon={<CalendarIcon size={32} />}
          title="אין תורים השבוע"
          subtitle="כשיקבעו תורים — הם יופיעו כאן"
        />
      )}
      </div>

      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onChanged={() => void fetchData()}
      />

      <NewAppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        clinicId={clinicId ?? ""}
        onCreated={() => void fetchData()}
        initialCustomerId={searchParams.get("customerId")}
        initialPetId={searchParams.get("petId")}
      />
    </div>
  );
}
