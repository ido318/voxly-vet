export type Vaccination = {
  id: string;
  clinicId: string;
  petId: string;
  customerId: string;
  visitId: string | null;
  vaccineName: string;
  administeredAt: string;
  batchNumber: string | null;
  nextDueAt: string | null;
  notes: string | null;
  administeredByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateVaccinationInput = {
  clinicId: string;
  customerId: string;
  vaccineName: string;
  administeredAt: string;
  visitId?: string | null;
  batchNumber?: string | null;
  nextDueAt?: string | null;
  notes?: string | null;
};

export type UpdateVaccinationInput = {
  vaccineName?: string;
  administeredAt?: string;
  visitId?: string | null;
  batchNumber?: string | null;
  nextDueAt?: string | null;
  notes?: string | null;
};
