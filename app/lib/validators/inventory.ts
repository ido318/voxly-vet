import { z } from "zod";

export const createInventoryItemSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().min(1).max(100).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  quantityOnHand: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional().nullable(),
  unitPrice: z.number().min(0).optional().nullable(),
});

export const inventoryAdjustmentSchema = z.object({
  clinicId: z.string().uuid(),
  quantityDelta: z.number().refine((value) => value !== 0),
  reason: z.string().trim().min(1).max(1000),
  transactionType: z.enum(["adjustment", "usage", "restock"]).optional(),
  sourceType: z.enum(["manual", "visit", "vaccination", "prescription"]).optional(),
  sourceId: z.string().uuid().optional().nullable(),
});
