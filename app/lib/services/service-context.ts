import type { ClinicRole } from "@/types/domain/clinic";

export type ServiceActor = {
  userId: string;
  clinicIds: string[];
  defaultClinicId: string | null;
  memberships: Array<{ clinicId: string; role: ClinicRole }>;
};
