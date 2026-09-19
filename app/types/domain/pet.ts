export type PetStatus = "active" | "inactive";

export type Pet = {
  id: string;
  clinicId: string;
  customerId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birthDate: string | null;
  weight: number | null;
  chipNumber: string | null;
  isNeutered: boolean;
  allergies: string | null;
  chronicConditions: string | null;
  currentMedications: string | null;
  notes: string | null;
  profileImageUrl: string | null;
  status: PetStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreatePetInput = {
  clinicId: string;
  customerId: string;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  weight?: number | null;
  chipNumber?: string | null;
  isNeutered?: boolean;
  allergies?: string | null;
  chronicConditions?: string | null;
  currentMedications?: string | null;
  notes?: string | null;
  profileImageUrl?: string | null;
  status?: PetStatus;
};

export type UpdatePetInput = Partial<Omit<CreatePetInput, "clinicId" | "customerId">>;

export type PetListFilters = {
  clinicIds: string[];
  customerId?: string;
  query?: string;
};
