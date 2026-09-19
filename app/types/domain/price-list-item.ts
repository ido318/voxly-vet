export type PriceListItem = {
  id: string;
  clinicId: string;
  name: string;
  defaultPrice: number;
  visitType: string | null;
  active: boolean;
  createdByUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreatePriceListItemInput = {
  clinicId: string;
  name: string;
  defaultPrice: number;
  visitType?: string | null;
};

export type UpdatePriceListItemInput = {
  version: number;
  name?: string;
  defaultPrice?: number;
  active?: boolean;
};
