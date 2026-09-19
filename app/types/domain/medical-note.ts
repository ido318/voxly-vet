export type MedicalNoteType =
  | "soap_subjective"
  | "soap_objective"
  | "soap_assessment"
  | "soap_plan"
  | "soap_full"
  | "general"
  | "follow_up"
  | "addendum";

export type MedicalNote = {
  id: string;
  clinicId: string;
  visitId: string;
  noteType: MedicalNoteType;
  content: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  parentNoteId: string | null;
  status: "draft" | "approved" | "archived";
  approvedByUserId: string | null;
  approvedAt: string | null;
  version: number;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * status is intentionally absent: every note is created as 'draft'
 * (medical-note.repository.ts create() writes it unconditionally).
 * 'approved' is reachable only through approveNote()/the dedicated approve
 * endpoint, which enforces assertMedicalNoteApproveAuthorized and stamps
 * approved_by_user_id/approved_at together with the status flip.
 */
export type CreateMedicalNoteInput = {
  noteType: MedicalNoteType;
  content: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  parentNoteId?: string | null;
};

export type UpdateMedicalNoteInput = {
  noteType?: MedicalNoteType;
  content?: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  status?: "draft" | "approved" | "archived";
};

/**
 * Body shape for POST /visits/:visitId/notes/:noteId/addendum. noteType is
 * fixed to "addendum" and parentNoteId is derived from the :noteId path
 * segment, so neither is client-supplied here.
 */
export type AddMedicalNoteAddendumInput = {
  content: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
};
