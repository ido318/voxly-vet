export type ProblemListSeverity = "mild" | "moderate" | "severe";

export type ProblemListEntry = {
  condition: string;
  onsetDate?: string | null;
  severity?: ProblemListSeverity | null;
  notes?: string | null;
};

export type MedicalRecord = {
  id: string;
  clinicId: string;
  petId: string;
  summary: string | null;
  activeProblemList: ProblemListEntry[];
  alerts: unknown[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type EnsureMedicalRecordForPetInput = {
  clinicId: string;
  petId: string;
};

export type UpdateMedicalRecordInput = {
  summary?: string | null;
  activeProblemList?: ProblemListEntry[];
  alerts?: unknown[];
};
