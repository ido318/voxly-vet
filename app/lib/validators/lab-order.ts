import { z } from "zod";

export const labOrderStatusSchema = z.enum(["ordered", "in_progress", "completed"]);

export const createLabOrderSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid(),
  visitId: z.string().uuid().optional().nullable(),
  testName: z.string().trim().min(1).max(200),
});

export const updateLabOrderSchema = z.object({
  version: z.number().int().min(0),
  status: labOrderStatusSchema.optional(),
  resultText: z.string().trim().max(4000).optional().nullable(),
  flagged: z.boolean().optional(),
});

export const listLabOrdersSchema = z.object({
  petId: z.string().uuid().optional(),
  status: labOrderStatusSchema.optional(),
});
