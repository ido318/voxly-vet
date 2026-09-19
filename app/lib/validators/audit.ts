import { z } from "zod";

export const createAuditLogSchema = z.object({
  clinicId: z.string().uuid().optional().nullable(),
  actorType: z.enum(["user", "system", "ai"]),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  beforePayload: z.record(z.string(), z.unknown()).optional().nullable(),
  afterPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
