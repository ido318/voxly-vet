import { z } from "zod";

export const medicalRecordTimelineTypeSchema = z.enum([
  "visit",
  "medical_note",
  "vital",
  "prescription",
  "vaccination",
  "lab_order",
]);

export const medicalRecordTimelineQuerySchema = z.object({
  type: medicalRecordTimelineTypeSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
});
