export type WaitlistEntry = {
  id: string;
  clinicId: string;
  customerId: string;
  petId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  petName: string | null;
  visitType: string;
  preferredStart: string | null;
  preferredEnd: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WaitlistListFilters = {
  clinicIds: string[];
};
