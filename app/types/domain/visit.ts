export type VisitStatus = "in_progress" | "completed" | "cancelled";

export type Visit = {
  id: string;
  clinicId: string;
  customerId: string;
  petId: string;
  appointmentId: string | null;
  medicalRecordId: string | null;
  status: VisitStatus;
  chiefComplaint: string | null;
  manualVisitSummary: string | null;
  aiVisitSummary: string | null;
  aiSummaryGeneratedAt: string | null;
  aiSummaryAcceptedByUserId: string | null;
  startedAt: string;
  completedAt: string | null;
  version: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateVisitInput = {
  clinicId: string;
  customerId: string;
  petId: string;
  appointmentId?: string | null;
  medicalRecordId?: string | null;
  chiefComplaint?: string | null;
  manualVisitSummary?: string | null;
};

export type UpdateVisitInput = {
  chiefComplaint?: string | null;
  manualVisitSummary?: string | null;
  appointmentId?: string | null;
  medicalRecordId?: string | null;
};

export type ChangeVisitStatusInput = {
  status: VisitStatus;
};

export type CloseVisitInput = {
  version: number;
};

export type VisitListFilters = {
  clinicIds: string[];
  petId?: string;
  customerId?: string;
  status?: VisitStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
