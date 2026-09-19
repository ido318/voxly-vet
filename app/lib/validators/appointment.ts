import { z } from "zod";
import { isExpectedDuration } from "@/lib/appointment-rules";

export const appointmentTypeSchema = z.enum([
  "checkup",
  "home_visit",
  "vaccination",
  "phone_consultation",
  "neutering",
  "consultation",
  "urgent",
  "follow_up",
  "other",
]);

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "pending_approval",
  "late_cancellation",
  "checked_in",
  "in_visit",
]);

export const appointmentSourceSchema = z.enum([
  "phone",
  "front_desk",
  "online",
  "internal",
  "other",
]);

export const createAppointmentSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  petId: z.string().uuid(),
  appointmentType: appointmentTypeSchema,
  source: appointmentSourceSchema,
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive(),
  reason: z.string().trim().max(400).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).refine(
  (value) => isExpectedDuration(value.appointmentType, value.durationMinutes),
  { path: ["durationMinutes"], message: "Duration does not match appointment type" },
);

export const updateAppointmentSchema = z
  .object({
    version: z.number().int().min(0),
    data: z
      .object({
        appointmentType: appointmentTypeSchema.optional(),
        source: appointmentSourceSchema.optional(),
        scheduledAt: z.string().datetime({ offset: true }).optional(),
        durationMinutes: z.number().int().positive().optional(),
        reason: z.string().trim().max(400).optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required",
      })
      .refine(
        (value) =>
          value.appointmentType === undefined ||
          value.durationMinutes === undefined ||
          isExpectedDuration(value.appointmentType, value.durationMinutes),
        { path: ["durationMinutes"], message: "Duration does not match appointment type" },
      ),
  })
  .strict();

export const changeStatusSchema = z.object({
  version: z.number().int().min(0),
  status: appointmentStatusSchema,
  cancellationReason: z.string().trim().max(400).optional().nullable(),
});

export const deleteAppointmentSchema = z.object({
  version: z.number().int().min(0),
});

export const listAppointmentsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  date: z.string().date().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: appointmentStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
});

export const availabilitySchema = z.object({
  clinicId: z.string().uuid(),
  date: z.string().date(),
  visitType: appointmentTypeSchema.default("checkup"),
});
