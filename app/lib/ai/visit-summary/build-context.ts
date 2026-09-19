import type { VisitSummaryContext } from "@/lib/ai/visit-summary/types";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit } from "@/types/domain/visit";

export const VISIT_SUMMARY_MAX_NOTE_CHARS = 4000;
export const VISIT_SUMMARY_MAX_SINGLE_NOTE_CHARS = 2000;

export const CLINICAL_RECORD_BEGIN = "=== CLINICAL_RECORD_BEGIN (untrusted source material) ===";
export const CLINICAL_RECORD_END = "=== CLINICAL_RECORD_END ===";

export function truncateNotes(notes: MedicalNote[]): MedicalNote[] {
  let remaining = VISIT_SUMMARY_MAX_NOTE_CHARS;
  const result: MedicalNote[] = [];

  for (const note of notes) {
    if (remaining <= 0) break;
    const allowed = Math.min(
      VISIT_SUMMARY_MAX_SINGLE_NOTE_CHARS,
      remaining,
      note.content.length,
    );
    const content = note.content.slice(0, allowed);
    result.push({
      ...note,
      content,
    });
    remaining -= content.length;
  }

  return result;
}

export function buildVisitSummaryContext(
  visit: Visit,
  pet: Pet,
  notes: MedicalNote[],
  prescriptions: Prescription[],
): VisitSummaryContext {
  return {
    visit,
    pet,
    notes: truncateNotes(notes),
    prescriptions,
  };
}

export function hasMinimumClinicalContext(
  visit: Visit,
  notes: MedicalNote[],
): boolean {
  const hasComplaint =
    Boolean(visit.chiefComplaint && visit.chiefComplaint.trim().length > 0);
  const hasNote = notes.some((note) => note.content.trim().length > 0);
  return hasComplaint || hasNote;
}

function buildClinicalRecordBody(context: VisitSummaryContext): string {
  const { visit, pet, notes, prescriptions } = context;
  const lines: string[] = [
    `Visit status: ${visit.status}`,
    `Started: ${visit.startedAt}`,
    visit.completedAt ? `Completed: ${visit.completedAt}` : null,
    visit.chiefComplaint ? `Chief complaint: ${visit.chiefComplaint}` : null,
    visit.manualVisitSummary ? `Manual summary (staff): ${visit.manualVisitSummary}` : null,
    "",
    `Pet: ${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""})`,
    pet.allergies ? `Allergies: ${pet.allergies}` : null,
    pet.chronicConditions ? `Chronic conditions: ${pet.chronicConditions}` : null,
    pet.currentMedications ? `Current medications: ${pet.currentMedications}` : null,
    "",
    "Medical notes:",
  ].filter((line): line is string => line !== null);

  if (notes.length === 0) {
    lines.push("(none)");
  } else {
    for (const note of notes) {
      lines.push(`- [${note.noteType}] ${note.content}`);
    }
  }

  lines.push("", "Prescriptions on this visit:");
  if (prescriptions.length === 0) {
    lines.push("(none)");
  } else {
    for (const rx of prescriptions) {
      lines.push(`- ${rx.medicationName} (${rx.status}): ${rx.instructions}`);
    }
  }

  return lines.join("\n");
}

export function serializeContextForPrompt(context: VisitSummaryContext): string {
  const body = buildClinicalRecordBody(context);
  return [CLINICAL_RECORD_BEGIN, body, CLINICAL_RECORD_END].join("\n");
}

export function estimateContextCharSize(context: VisitSummaryContext): number {
  return serializeContextForPrompt(context).length;
}

export function estimateContextTokenCount(charSize: number): number {
  return Math.ceil(charSize / 4);
}

export function buildAiEventInputSnapshot(
  context: VisitSummaryContext,
): Record<string, unknown> {
  const contextCharSize = estimateContextCharSize(context);
  return {
    visitId: context.visit.id,
    visitStatus: context.visit.status,
    noteCount: context.notes.length,
    noteTypes: context.notes.map((n) => n.noteType),
    prescriptionCount: context.prescriptions.length,
    hasChiefComplaint: Boolean(context.visit.chiefComplaint?.trim()),
    hasManualSummary: Boolean(context.visit.manualVisitSummary?.trim()),
    contextCharSize,
    estimatedTokenCount: estimateContextTokenCount(contextCharSize),
  };
}

export function buildAiEventGeneratedOutputSnapshot(
  context: VisitSummaryContext,
  outputLength: number,
  modelName: string,
): Record<string, unknown> {
  const contextCharSize = estimateContextCharSize(context);
  return {
    outputLength,
    modelName,
    noteCount: context.notes.length,
    noteTypes: context.notes.map((n) => n.noteType),
    contextCharSize,
    estimatedTokenCount: estimateContextTokenCount(contextCharSize),
  };
}
