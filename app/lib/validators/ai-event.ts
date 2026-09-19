import { z } from "zod";

export const createAIEventSchema = z.object({
  clinicId: z.string().uuid(),
  sourceType: z.string().min(1),
  sourceId: z.string().optional().nullable(),
  agentName: z.string().min(1),
  eventType: z.string().min(1),
  inputPayload: z.record(z.string(), z.unknown()).optional(),
  outputPayload: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  modelName: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
