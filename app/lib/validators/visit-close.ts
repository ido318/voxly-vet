import { z } from "zod";

export const closeVisitSchema = z.object({
  version: z.number().int().min(0),
  followUp: z.object({
    reason: z.string().trim().min(1).max(2000),
    dueAt: z.string().datetime({ offset: true }),
  }).optional(),
});
