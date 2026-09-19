import { z } from "zod";

export const createVaccinationSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  vaccineName: z.string().trim().min(1).max(200),
  administeredAt: z.string().datetime(),
  visitId: z.string().uuid().optional().nullable(),
  batchNumber: z.string().trim().max(100).optional().nullable(),
  nextDueAt: z.string().date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateVaccinationSchema = z
  .object({
    vaccineName: z.string().trim().min(1).max(200).optional(),
    administeredAt: z.string().datetime().optional(),
    visitId: z.string().uuid().optional().nullable(),
    batchNumber: z.string().trim().max(100).optional().nullable(),
    nextDueAt: z.string().date().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
