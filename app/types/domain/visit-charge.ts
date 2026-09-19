export type VisitChargeStatus = "pending" | "reviewed" | "invoiced" | "void";

export type VisitCharge = {
  id: string;
  clinicId: string;
  visitId: string;
  customerId: string;
  petId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  status: VisitChargeStatus;
  invoiceId: string | null;
  sourceType: string;
  sourceId: string | null;
  createdByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateVisitChargeInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  sourceType?: string;
  sourceId?: string | null;
};
