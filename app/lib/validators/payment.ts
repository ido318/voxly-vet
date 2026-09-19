import { z } from "zod";

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  clinicId: z.string().uuid().optional(),
  amount: z.number().positive(),
  method: z.enum(["cash", "card", "bank_transfer", "bit", "other"]),
  paidAt: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
