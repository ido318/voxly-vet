import { z } from "zod";

export const createPriceListItemSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  defaultPrice: z.number().nonnegative(),
  visitType: z.string().trim().max(50).optional().nullable(),
});

export const updatePriceListItemSchema = z.object({
  version: z.number().int().min(0),
  name: z.string().trim().min(1).max(200).optional(),
  defaultPrice: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});
