// Visit types, their durations and their Hebrew labels — the single source of
// truth for both workspaces.
//
// These are binding clinic decisions (CLAUDE.md, 2026-06-11): the durations
// feed appointments.duration_minutes, requiresApproval is what routes
// neutering to pending_approval, and labelHe is what Tomer says out loud and
// what the booking SMS prints. They lived in two hand-maintained copies —
// agent/src/lib/appointments.ts and app/lib/appointment-rules.ts — which
// agreed only because nobody had edited one of them yet. The Jerusalem-time
// and SMS-template duplication that preceded this produced a real wording bug
// before it was unified here; this is the same shape of risk.

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
  /** Only neutering: Tomer books it as pending_approval for Dana to confirm. */
  requiresApproval: boolean;
  labelHe: string;
};

/** effective duration = durationMin + bufferMin, stored as duration_minutes. */
export const VISIT_TYPE_CONFIG: Record<VisitType, VisitTypeConfig> = {
  checkup:            { durationMin: 30, bufferMin: 10, requiresApproval: false, labelHe: "בדיקה בקליניקה" },
  home_visit:         { durationMin: 60, bufferMin: 30, requiresApproval: false, labelHe: "ביקור בית" },
  vaccination:        { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "חיסונים" },
  phone_consultation: { durationMin: 20, bufferMin:  0, requiresApproval: false, labelHe: "ייעוץ טלפוני" },
  neutering:          { durationMin: 30, bufferMin: 10, requiresApproval: true,  labelHe: "עיקור/סירוס" },
  consultation:       { durationMin: 20, bufferMin: 10, requiresApproval: false, labelHe: "ייעוץ" },
  urgent:             { durationMin: 30, bufferMin:  0, requiresApproval: false, labelHe: "דחוף" },
  follow_up:          { durationMin: 30, bufferMin:  0, requiresApproval: false, labelHe: "ביקור מעקב" },
  other:              { durationMin: 30, bufferMin:  0, requiresApproval: false, labelHe: "אחר" },
};

/** Falls back to `other` rather than throwing on an unrecognised type. */
export function getVisitConfig(visitType: string): VisitTypeConfig {
  return VISIT_TYPE_CONFIG[visitType as VisitType] ?? VISIT_TYPE_CONFIG.other;
}

export function effectiveDuration(visitType: string): number {
  const config = getVisitConfig(visitType);
  return config.durationMin + config.bufferMin;
}
