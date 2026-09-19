import { z } from "zod";

export const problemListEntrySchema = z.object({
  condition: z.string().trim().min(1).max(500),
  // A real calendar-date check, not just a YYYY-MM-DD shape check — z.iso.date()
  // rejects things like "2024-13-45" or "2023-02-29". formatIsraelDate throws on
  // an unparseable date, so a bad value here would crash the record view.
  onsetDate: z.iso.date().optional().nullable(),
  severity: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateMedicalRecordSchema = z
  .object({
    summary: z.string().trim().max(12000).optional().nullable(),
    activeProblemList: z.array(problemListEntrySchema).max(50).optional(),
    alerts: z.array(z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
