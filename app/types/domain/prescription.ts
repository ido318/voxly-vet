export type PrescriptionStatus = "draft" | "active" | "discontinued";

export type Prescription = {
  id: string;
  clinicId: string;
  visitId: string;
  petId: string;
  medicationName: string;
  instructions: string;
  status: PrescriptionStatus;
  discontinuedAt: string | null;
  prescribedAt: string;
  prescribedByUserId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreatePrescriptionInput = {
  medicationName: string;
  instructions: string;
  status?: PrescriptionStatus;
  notes?: string | null;
};

export type UpdatePrescriptionInput = {
  medicationName?: string;
  instructions?: string;
  status?: PrescriptionStatus;
  notes?: string | null;
  discontinuedAt?: string | null;
};
