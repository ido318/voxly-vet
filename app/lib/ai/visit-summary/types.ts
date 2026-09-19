import type { MedicalNote } from "@/types/domain/medical-note";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit } from "@/types/domain/visit";

export type VisitSummaryContext = {
  visit: Visit;
  pet: Pet;
  notes: MedicalNote[];
  prescriptions: Prescription[];
};

export type VisitSummaryGenerationResult = {
  draftText: string;
  modelName: string;
};

export type VisitSummaryProvider = {
  generateSummary(context: VisitSummaryContext): Promise<VisitSummaryGenerationResult>;
};
