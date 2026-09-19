"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import {
  CheckIcon,
  ClockIcon,
  PhoneIcon,
  PlusIcon,
  SparkleIcon,
  UserIcon,
  XIcon,
} from "@/components/dashboard/icons";
import type { Appointment } from "@/types/domain/appointment";
import type {
  TodayActivityItem,
  TodayAttentionItem,
  TodayMetric,
  TodayScheduleRow,
} from "./today-dashboard-model";

const metricToneClasses: Record<TodayMetric["tone"], { bar: string; value: string }> = {
  brand: { bar: "bg-[var(--accent)]", value: "text-[var(--accent)]" },
  amber: { bar: "bg-[var(--status-pending-text)]", value: "text-[var(--status-pending-text)]" },
  coral: { bar: "bg-[var(--status-critical-text)]", value: "text-[var(--status-critical-text)]" },
  red: { bar: "bg-[var(--status-critical-text)]", value: "text-[var(--status-critical-text)]" },
};

export function TodayPageHeading() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
      <h1 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">היום במרפאה</h1>
      <Btn href="/dashboard/calendar?newAppointment=1" size="lg">
        <PlusIcon size={16} />
        יצירה מהירה
      </Btn>
    </div>
  );
}

export function TodayMetrics({ metrics }: { metrics: TodayMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" dir="ltr">
      {metrics.map((metric) => {
        const tone = metricToneClasses[metric.tone];
        return (
          <Card key={metric.label} className="relative min-h-[84px] overflow-hidden p-4" dir="rtl">
            <span className={["absolute end-4 top-5 h-10 w-1 rounded-full opacity-90", tone.bar].join(" ")} />
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">{metric.label}</p>
            <p className={["mt-2 text-[29px] font-semibold leading-none tabular-nums", tone.value].join(" ")}>
              {metric.value}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

export function ScheduleList({
  rows,
  onApprove,
  onReject,
}: {
  rows: TodayScheduleRow[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  return (
    <Card noPad className="min-h-[484px] overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">סדר יום תורים</h2>
        <Link href="/dashboard/calendar" className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
          לוח שנה מלא →
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClockIcon size={28} />}
          title="אין תורים להיום"
          subtitle="כשיהיו תורים להיום הם יופיעו כאן"
          className="py-12"
        />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {rows.map((row) => {
            const isPending = row.status === "pending_approval";
            return (
              <div
                key={row.id}
                className="grid min-h-[64px] grid-cols-[66px_40px_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2.5 transition-colors hover:bg-white lg:grid-cols-[66px_40px_minmax(0,1fr)_auto]"
              >
                <div className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{row.time}</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border-row)] text-[13px] font-semibold text-[var(--text-secondary)]">
                  {row.petName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{row.petName}</p>
                    <TypePill type={row.appointmentType} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                    {row.reason} · {row.customerName}
                  </p>
                </div>
                <div className="col-span-3 flex flex-wrap items-center justify-end gap-2 lg:col-span-1">
                  <Badge tone={isPending ? "pending" : "neutral"}>
                    {isPending ? "ממתין" : row.status === "completed" ? "הושלם" : "מתוכנן"}
                  </Badge>
                  {isPending && (
                    <div className="flex gap-1">
                      <Btn size="sm" variant="soft" onClick={() => onApprove(row.appointment)}>
                        <CheckIcon size={12} />
                        אשר
                      </Btn>
                      <Btn size="sm" variant="dangerSoft" onClick={() => onReject(row.appointment)}>
                        <XIcon size={12} />
                        דחה
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function CareFlowPanel({
  checkedInRows,
  inVisitRows,
}: {
  checkedInRows: TodayScheduleRow[];
  inVisitRows: TodayScheduleRow[];
}) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-2">
        <section className="border-b border-[var(--border-row)] p-5 md:border-b-0 md:border-e">
          <h2 className="gv-section-label" style={{ color: "var(--text-muted)" }}>ממתינים לביקור</h2>
          <div className="mt-3 space-y-2">
            {checkedInRows.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין מטופלים שממתינים לפתיחת ביקור.</p>
            ) : (
              checkedInRows.map((row) => (
                <Link
                  key={row.id}
                  href={`/dashboard/calendar?appointmentId=${row.appointment.id}`}
                  className="block rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2 transition-colors hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.petName}</p>
                    <Badge tone="pending">צ׳ק־אין</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{row.time} · {row.customerName}</p>
                </Link>
              ))
            )}
          </div>
        </section>
        <section className="p-5">
          <h2 className="gv-section-label" style={{ color: "var(--text-muted)" }}>בטיפול</h2>
          <div className="mt-3 space-y-2">
            {inVisitRows.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין ביקורים פעילים כרגע.</p>
            ) : (
              inVisitRows.map((row) => (
                <Link
                  key={row.id}
                  href={`/dashboard/pets/${row.appointment.petId}`}
                  className="block rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2 transition-colors hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.petName}</p>
                    <Badge tone="info">בטיפול</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{row.reason} · {row.customerName}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </Card>
  );
}

const ATTENTION_VISIBLE_COUNT = 5;

export function AttentionPanel({
  items,
  onApprove,
  onReject,
}: {
  items: TodayAttentionItem[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, ATTENTION_VISIBLE_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <Card noPad className="min-h-[232px] overflow-hidden">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <SparkleIcon size={16} className="text-[var(--red-600)]" />
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">דורש תשומת לב</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין נושאים דחופים" subtitle="המרפאה נקייה מפריטים לטיפול מיידי" className="py-12" />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {visibleItems.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3 transition-colors hover:bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.subtitle}</p>
                </div>
                <Badge tone={item.tone === "red" ? "critical" : "pending"}>
                  {item.kind === "pending_approval" ? "היום" : "דחוף"}
                </Badge>
              </div>
              {item.urgency != null && <UrgencyMeter value={item.urgency} className="mt-3" />}
              {item.appointment && (
                <div className="mt-3 flex gap-1.5">
                  <Btn size="sm" variant="soft" onClick={() => onApprove(item.appointment!)}>
                    <CheckIcon size={12} />
                    אשר
                  </Btn>
                  <Btn size="sm" variant="dangerSoft" onClick={() => onReject(item.appointment!)}>
                    <XIcon size={12} />
                    דחה
                  </Btn>
                </div>
              )}
              {/* Only appointments had actions here, so an escalation was a
                  dead card: nothing to click, no number to call. */}
              {item.escalation && (
                <div className="mt-3 flex gap-1.5">
                  {item.escalation.callerPhone && (
                    <Btn size="sm" variant="soft" href={`tel:${item.escalation.callerPhone}`}>
                      <PhoneIcon size={12} />
                      חייג
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" href="/dashboard/escalations">
                    פתח
                  </Btn>
                </div>
              )}
            </div>
          ))}
          {items.length > ATTENTION_VISIBLE_COUNT && (
            <Btn
              size="sm"
              variant="ghost"
              className="w-full justify-center"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "הצג פחות" : `+${hiddenCount} נוספים`}
            </Btn>
          )}
        </div>
      )}
    </Card>
  );
}

export function RecentActivityPanel({ items }: { items: TodayActivityItem[] }) {
  return (
    <Card noPad className="min-h-[232px] overflow-hidden">
      <div className="px-5 pb-3 pt-5">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">פעילות אחרונה</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין פעילות אחרונה" subtitle="שיחות ועדכונים מהיום יופיעו כאן" className="py-12" />
      ) : (
        <div className="space-y-4 px-5 pb-5">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="truncate text-[12px] text-[var(--text-secondary)]">{item.subtitle}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TodayEmptyState() {
  return (
    <EmptyState
      icon={<UserIcon size={32} />}
      title="אין פעילות להיום"
      subtitle="כשיהיו תורים, שיחות או פריטים לטיפול הם יופיעו כאן"
    />
  );
}

export function CallShortcut() {
  return (
    <Link
      href="/dashboard/calls"
      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)] hover:underline"
    >
      <PhoneIcon size={14} />
      כל השיחות
    </Link>
  );
}
