export type Profile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  defaultClinicId: string | null;
  role: "clinic_user" | "provider_admin";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
