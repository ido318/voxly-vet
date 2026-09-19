import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

export const createInvoiceSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid().optional().nullable(),
  items: z.array(invoiceLineItemSchema).min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "void"]);

export const updateInvoiceStatusSchema = z.object({
  version: z.number().int().min(0),
  status: invoiceStatusSchema,
});

export const listInvoicesSchema = z.object({
  customerId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
});
