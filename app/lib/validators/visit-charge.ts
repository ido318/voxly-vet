import { z } from "zod";

export const createVisitChargeSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  sourceType: z.string().trim().max(80).optional(),
  sourceId: z.string().uuid().optional().nullable(),
});

export const createInvoiceFromVisitSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});
