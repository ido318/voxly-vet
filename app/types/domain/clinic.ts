import type { SmsTemplateKey } from "@tomer/shared";

export type ClinicRole = "owner" | "admin" | "staff" | "veterinarian";

export type ClinicBusinessHourEntry = { day: string; hours: string };
export type ClinicVisitPriceEntry = { label: string; detail: string };
export type ClinicContactInfo = { address: string; whatsapp: string; email: string };

export type ClinicSettings = {
  businessHours: ClinicBusinessHourEntry[];
  visitPrices: ClinicVisitPriceEntry[];
  contact: ClinicContactInfo;
  smsTemplates: Partial<Record<SmsTemplateKey, string>>;
};

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  settings: ClinicSettings;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ClinicMembership = {
  id: string;
  clinicId: string;
  userId: string;
  role: ClinicRole;
  createdAt: string;
  updatedAt: string;
};

export type ClinicMembershipWithClinic = ClinicMembership & {
  clinic: Pick<Clinic, "id" | "name" | "slug">;
};
