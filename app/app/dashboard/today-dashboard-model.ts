import { formatIsraelTime, israelDateIso } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";
import { formatEscalationReason } from "@/lib/triage-labels";

export type MetricTone = "brand" | "amber" | "coral" | "red";

export type TodayMetric = {
  label: string;
  value: number;
  tone: MetricTone;
};

export type TodayScheduleRow = {
  id: string;
  time: string;
  petName: string;
  customerName: string;
  appointmentType: string;
  status: Appointment["status"];
  reason: string;
  appointment: Appointment;
};

export type TodayAttentionItem = {
  id: string;
  kind: "pending_approval" | "escalation";
  title: string;
  subtitle: string;
  tone: "amber" | "red";
  urgency?: number;
  appointment?: Appointment;
  escalation?: Escalation;
};

export type TodayActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  tone: "brand" | "muted";
};

export type TodayDashboardModel = {
  metrics: TodayMetric[];
  scheduleRows: TodayScheduleRow[];
  checkedInRows: TodayScheduleRow[];
  inVisitRows: TodayScheduleRow[];
  attentionItems: TodayAttentionItem[];
  activityItems: TodayActivityItem[];
};

type Input = {
  today: string;
  appointments: Appointment[];
  escalations: Escalation[];
  todayCalls: VoiceCall[];
  waitlistCount: number;
};

export function buildTodayDashboardModel({
  today,
  appointments,
  escalations,
  todayCalls,
  waitlistCount,
}: Input): TodayDashboardModel {
  const todayAppointments = appointments
    .filter((appointment) => israelDateIso(appointment.scheduledAt) === today)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const pendingApprovals = todayAppointments.filter((appointment) => appointment.status === "pending_approval");
  const checkedInAppointments = todayAppointments.filter((appointment) => appointment.status === "checked_in");
  const inVisitAppointments = todayAppointments.filter((appointment) => appointment.status === "in_visit");
  const activeCareCount = todayAppointments.filter((appointment) =>
    appointment.status === "scheduled" ||
    appointment.status === "confirmed" ||
    appointment.status === "checked_in" ||
    appointment.status === "in_visit"
  ).length;
  const toScheduleRow = (appointment: Appointment): TodayScheduleRow => ({
    id: appointment.id,
    time: formatIsraelTime(appointment.scheduledAt),
    petName: appointment.petName ?? "מטופל ללא שם",
    customerName: appointment.customerName ?? "לקוח ללא שם",
    appointmentType: appointment.appointmentType,
    status: appointment.status,
    reason: appointment.reason ?? "ללא סיבת ביקור",
    appointment,
  });

  return {
    metrics: [
      { label: "תורים היום", value: todayAppointments.length, tone: "brand" },
      { label: "ממתינים", value: waitlistCount, tone: "amber" },
      { label: "בטיפול", value: activeCareCount, tone: "coral" },
      { label: "דורשים תשומת לב", value: escalations.length + pendingApprovals.length, tone: "red" },
    ],
    scheduleRows: todayAppointments.map(toScheduleRow),
    checkedInRows: checkedInAppointments.map(toScheduleRow),
    inVisitRows: inVisitAppointments.map(toScheduleRow),
    attentionItems: [
      ...pendingApprovals.map((appointment): TodayAttentionItem => ({
        id: `pending-${appointment.id}`,
        kind: "pending_approval",
        title: `${appointment.petName ?? "מטופל"} ממתין לאישור`,
        subtitle: `${formatIsraelTime(appointment.scheduledAt)} · ${appointment.customerName ?? "לקוח ללא שם"}`,
        tone: "amber",
        appointment,
      })),
      ...escalations.map((escalation): TodayAttentionItem => ({
        id: `escalation-${escalation.id}`,
        kind: "escalation",
        title: formatEscalationReason(escalation.reason),
        // Used to be the timestamp alone. An escalation card with no name is
        // the thing the team reported: "דורש תשומת לב" listed a reason string
        // and nothing that said who it was about.
        subtitle: [
          escalation.customerName,
          escalation.petName,
          escalation.afterHours ? "אחרי שעות הפעילות" : formatIsraelTime(escalation.createdAt),
        ]
          .filter(Boolean)
          .join(" · "),
        tone: escalation.urgency >= 8 ? "red" : "amber",
        urgency: escalation.urgency,
        escalation,
      })),
    ],
    activityItems: todayCalls.slice(0, 4).map((call) => ({
      id: call.id,
      title: call.status === "completed" ? "שיחה הושלמה" : "שיחה נכנסת",
      subtitle: call.aiSummary ?? call.fromNumber,
      time: formatIsraelTime(call.startedAt),
      tone: call.status === "completed" ? "brand" : "muted",
    })),
  };
}
