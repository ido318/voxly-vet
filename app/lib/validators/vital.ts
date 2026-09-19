import { z } from "zod";

export const createVitalSchema = z.object({
  recordedAt: z.string().datetime({ offset: true }).optional(),
  weightKg: z.number().positive().max(250).optional().nullable(),
  temperatureC: z.number().min(30).max(45).optional().nullable(),
  heartRateBpm: z.number().int().positive().max(400).optional().nullable(),
  respiratoryRateBpm: z.number().int().positive().max(200).optional().nullable(),
  mucousMembrane: z.string().trim().max(120).optional().nullable(),
  capillaryRefillTime: z.string().trim().max(120).optional().nullable(),
  bodyConditionScore: z.number().min(1).max(9).optional().nullable(),
  painScore: z.number().int().min(0).max(10).optional().nullable(),
  hydrationStatus: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
