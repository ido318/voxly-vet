export type AiArtifactType =
  | "patient_summary"
  | "draft_soap"
  | "client_instructions"
  | "extracted_tasks";

export type AiArtifactSourceType = "pet" | "visit" | "call";
export type AiArtifactStatus = "draft" | "approved" | "rejected";

export type AiSummary = {
  id: string;
  clinicId: string;
  artifactType: AiArtifactType;
  sourceType: AiArtifactSourceType;
  sourceId: string | null;
  status: AiArtifactStatus;
  draftText: string;
  structuredPayload: Record<string, unknown>;
  modelName: string | null;
  promptVersion: string | null;
  createdByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateAiSummaryInput = {
  clinicId: string;
  artifactType: AiArtifactType;
  sourceType: AiArtifactSourceType;
  sourceId?: string | null;
  draftText: string;
  structuredPayload?: Record<string, unknown>;
  modelName?: string | null;
  promptVersion?: string | null;
};
