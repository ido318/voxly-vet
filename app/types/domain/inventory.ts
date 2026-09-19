export type InventoryItem = {
  id: string;
  clinicId: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number | null;
  unitPrice: number | null;
  active: boolean;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateInventoryItemInput = {
  clinicId: string;
  name: string;
  sku?: string | null;
  category?: string;
  unit?: string;
  quantityOnHand?: number;
  reorderLevel?: number;
  unitCost?: number | null;
  unitPrice?: number | null;
};

export type InventoryAdjustmentInput = {
  quantityDelta: number;
  reason: string;
  transactionType?: "adjustment" | "usage" | "restock";
  sourceType?: "manual" | "visit" | "vaccination" | "prescription";
  sourceId?: string | null;
};
