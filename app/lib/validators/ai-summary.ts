import { z } from "zod";

export const aiSourceTypeSchema = z.enum(["pet", "visit", "call"]);

const generateAiArtifactSchema = z.object({
  clinicId: z.string().uuid(),
  sourceType: aiSourceTypeSchema,
  sourceId: z.string().uuid().optional().nullable(),
  sourceText: z.string().trim().min(1).max(8000),
});

export const patientSummarySchema = generateAiArtifactSchema;
export const draftSoapSchema = generateAiArtifactSchema;
export const draftClientInstructionsSchema = generateAiArtifactSchema;
export const extractTasksSchema = generateAiArtifactSchema;

export const rejectAiArtifactSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

/**
 * Body for POST /visits/:visitId/soap-draft — the client only supplies the
 * storagePath of an already-uploaded dictation recording (see
 * soap-recording/route.ts); clinicId/sourceType/sourceId are derived
 * server-side from the visit itself, never trusted from the request.
 */
export const soapDraftFromRecordingSchema = z.object({
  storagePath: z.string().trim().min(1),
});
