import { z } from "zod";
import { taskStatusSchema } from "@/lib/validators/task";

export const createFollowUpSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid().optional().nullable(),
  visitId: z.string().uuid().optional().nullable(),
  voiceCallId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(1).max(2000),
  dueAt: z.string().datetime({ offset: true }),
});

export const completeFollowUpSchema = z.object({
  version: z.number().int().min(0),
});

export const listFollowUpsSchema = z.object({
  status: taskStatusSchema.optional(),
});
