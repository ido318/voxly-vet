export type LabOrderStatus = "ordered" | "in_progress" | "completed";

export type LabOrder = {
  id: string;
  clinicId: string;
  customerId: string;
  customerName?: string | null;
  petId: string;
  petName?: string | null;
  visitId: string | null;
  testName: string;
  status: LabOrderStatus;
  resultText: string | null;
  flagged: boolean;
  orderedByUserId: string | null;
  orderedAt: string;
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateLabOrderInput = {
  clinicId: string;
  customerId: string;
  petId: string;
  visitId?: string | null;
  testName: string;
};

export type UpdateLabOrderInput = {
  version: number;
  status?: LabOrderStatus;
  resultText?: string | null;
  flagged?: boolean;
};

export type LabOrderListFilters = {
  clinicIds: string[];
  petId?: string;
  status?: LabOrderStatus;
};
