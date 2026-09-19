import { z } from "zod";

export const appointmentWorkflowActionSchema = z.object({
  version: z.number().int().min(0),
});
