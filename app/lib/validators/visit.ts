import { z } from "zod";

export const visitStatusSchema = z.enum(["in_progress", "completed", "cancelled"]);

export const createVisitSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  medicalRecordId: z.string().uuid().optional().nullable(),
  chiefComplaint: z.string().trim().max(2000).optional().nullable(),
  manualVisitSummary: z.string().trim().max(8000).optional().nullable(),
});

export const updateVisitSchema = z
  .object({
    version: z.number().int().min(0),
    status: visitStatusSchema.optional(),
    data: z
      .object({
        chiefComplaint: z.string().trim().max(2000).optional().nullable(),
        manualVisitSummary: z.string().trim().max(8000).optional().nullable(),
        appointmentId: z.string().uuid().optional().nullable(),
        medicalRecordId: z.string().uuid().optional().nullable(),
      })
      .optional(),
  })
  .refine((value) => value.status !== undefined || (value.data && Object.keys(value.data).length > 0), {
    message: "Either status or data fields are required",
  });

export const listVisitsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: visitStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const deleteVisitSchema = z.object({
  version: z.number().int().min(0),
});
