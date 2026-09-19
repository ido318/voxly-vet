export type CustomerStatus = "active" | "inactive";
export type PreferredContactMethod = "phone" | "sms" | "email" | "whatsapp";

export type Customer = {
  id: string;
  clinicId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  preferredContactMethod: PreferredContactMethod;
  notes: string | null;
  status: CustomerStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CustomerDuplicate = Pick<
  Customer,
  "id" | "clinicId" | "fullName" | "phone" | "email"
>;

export type CreateCustomerInput = {
  clinicId: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  preferredContactMethod?: PreferredContactMethod;
  notes?: string | null;
  status?: CustomerStatus;
  tags?: string[];
};

export type UpdateCustomerInput = Partial<
  Omit<CreateCustomerInput, "clinicId"> & {
    clinicId: string;
  }
>;

export type CustomerListFilters = {
  clinicIds: string[];
  query?: string;
  page?: number;
  pageSize?: number;
};
