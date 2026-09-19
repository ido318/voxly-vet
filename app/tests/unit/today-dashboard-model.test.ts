import { describe, expect, it } from "vitest";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";
import { buildTodayDashboardModel } from "@/app/dashboard/today-dashboard-model";

const baseAppointment: Appointment = {
  id: "appt-1",
  clinicId: "clinic-1",
  customerId: "customer-1",
  petId: "pet-1",
  customerName: "דנה כהן",
  petName: "לונה",
  petSpecies: "dog",
  appointmentType: "checkup",
  status: "scheduled",
  source: "phone",
  scheduledAt: "2026-08-29T06:30:00.000Z",
  durationMinutes: 40,
  reason: "בדיקה כללית",
  notes: null,
  version: 1,
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  createdByUserId: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
  deletedAt: null,
};

const escalation: Escalation = {
  id: "esc-1",
  clinicId: "clinic-1",
  voiceCallId: null,
  elevenLabsConversationId: null,
  callerPhone: null,
  customerId: null,
  customerName: null,
  petId: null,
  petName: null,
  context: {},
  reason: "ספקית דם מראה אנמיה חריפה",
  urgency: 9,
  resolvedAt: null,
  resolvedBy: null,
  notes: null,
  createdAt: "2026-08-29T07:15:00.000Z",
  updatedAt: "2026-08-29T07:15:00.000Z",
  afterHours: false,
};

const call: VoiceCall = {
  id: "call-1",
  clinicId: "clinic-1",
  customerId: null,
  petId: null,
  appointmentId: null,
  visitId: null,
  direction: "inbound",
  status: "completed",
  fromNumber: "+972501234567",
  toNumber: "+972359012345",
  twilioCallSid: null,
  twilioParentCallSid: null,
  elevenLabsConversationId: null,
  agentName: "Tomer",
  startedAt: "2026-08-29T08:00:00.000Z",
  endedAt: "2026-08-29T08:03:00.000Z",
  durationSeconds: 180,
  recordingUrl: null,
  recordingStoragePath: null,
  transcript: null,
  aiSummary: "לקוחה ביקשה לקבוע חיסון.",
  callCategory: "operation",
  metadata: {},
  createdAt: "2026-08-29T08:00:00.000Z",
  updatedAt: "2026-08-29T08:03:00.000Z",
};

describe("buildTodayDashboardModel", () => {
  it("maps existing dashboard data into Figma-style metrics and sections", () => {
    const pendingApproval = {
      ...baseAppointment,
      id: "appt-2",
      petName: "צ'אקי",
      appointmentType: "neutering" as const,
      status: "pending_approval" as const,
      scheduledAt: "2026-08-29T08:00:00.000Z",
    };

    const model = buildTodayDashboardModel({
      today: "2026-08-29",
      appointments: [pendingApproval, baseAppointment],
      escalations: [escalation],
      todayCalls: [call],
      waitlistCount: 4,
    });

    expect(model.metrics).toEqual([
      { label: "תורים היום", value: 2, tone: "brand" },
      { label: "ממתינים", value: 4, tone: "amber" },
      { label: "בטיפול", value: 1, tone: "coral" },
      { label: "דורשים תשומת לב", value: 2, tone: "red" },
    ]);
    expect(model.scheduleRows.map((row) => row.id)).toEqual(["appt-1", "appt-2"]);
    expect(model.attentionItems).toHaveLength(2);
    expect(model.attentionItems[0]).toMatchObject({ kind: "pending_approval", title: "צ'אקי ממתין לאישור" });
    expect(model.activityItems[0]).toMatchObject({ title: "שיחה הושלמה", subtitle: "לקוחה ביקשה לקבוע חיסון." });
  });
}
);
