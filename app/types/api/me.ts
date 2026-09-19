import type { ClinicRole } from "@/types/domain/clinic";

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    id: string;
    fullName: string | null;
    phone: string | null;
    defaultClinicId: string | null;
    role: "clinic_user" | "provider_admin";
  };
  memberships: Array<{
    clinicId: string;
    clinicName: string;
    clinicSlug: string;
    role: ClinicRole;
  }>;
};

export type HealthResponse = {
  status: "ok";
  env: string;
  timestamp: string;
  db: "connected" | "degraded";
};
