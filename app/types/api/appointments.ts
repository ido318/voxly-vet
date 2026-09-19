import type { Appointment } from "@/types/domain/appointment";

export type AppointmentListResponse = {
  items: Appointment[];
};

export type CalendarAvailabilityResponse = {
  clinicId: string;
  date: string;
  slotMinutes: number;
  timezone: string;
  availableSlots: string[];
};
