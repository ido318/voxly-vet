import { z } from "zod";

export const acceptVisitSummarySchema = z.object({
  version: z.number().int().nonnegative(),
  summaryText: z.string().trim().min(1).max(8000),
});
