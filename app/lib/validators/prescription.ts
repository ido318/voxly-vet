import { z } from "zod";

export const prescriptionStatusSchema = z.enum(["draft", "active", "discontinued"]);

export const createPrescriptionSchema = z.object({
  medicationName: z.string().trim().min(1).max(200),
  instructions: z.string().trim().min(1).max(4000),
  status: z.enum(["draft"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updatePrescriptionSchema = z
  .object({
    medicationName: z.string().trim().min(1).max(200).optional(),
    instructions: z.string().trim().min(1).max(4000).optional(),
    status: prescriptionStatusSchema.optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
