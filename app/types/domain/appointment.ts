export type AppointmentType =
  | "checkup"
  | "home_visit"
  | "vaccination"
  | "phone_consultation"
  | "neutering"
  | "consultation"
  | "urgent"
  | "follow_up"
  | "other";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pending_approval"
  | "late_cancellation"
  | "checked_in"
  | "in_visit";

export type AppointmentSource =
  | "phone"
  | "front_desk"
  | "online"
  | "internal"
  | "other";

export type Appointment = {
  id: string;
  clinicId: string;
  customerId: string;
  petId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  petName?: string | null;
  petSpecies?: string | null;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  source: AppointmentSource;
  scheduledAt: string;
  durationMinutes: number;
  reason: string | null;
  notes: string | null;
  version: number;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateAppointmentInput = {
  clinicId: string;
  customerId: string;
  petId: string;
  appointmentType: AppointmentType;
  source: AppointmentSource;
  scheduledAt: string;
  durationMinutes: number;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateAppointmentInput = {
  appointmentType?: AppointmentType;
  source?: AppointmentSource;
  scheduledAt?: string;
  durationMinutes?: number;
  reason?: string | null;
  notes?: string | null;
};

export type ChangeAppointmentStatusInput = {
  status: AppointmentStatus;
  cancellationReason?: string | null;
};

export type AppointmentListFilters = {
  clinicIds: string[];
  date?: string;
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  customerId?: string;
  petId?: string;
};
