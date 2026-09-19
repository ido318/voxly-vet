import { z } from "zod";

export const voiceCallStatusSchema = z.enum([
  "queued",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
]);

export const listVoiceCallsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  visitId: z.string().uuid().optional(),
  status: voiceCallStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const linkVoiceCallSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  petId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid().optional().nullable(),
  visitId: z.string().uuid().optional().nullable(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one link field is required",
});

export const twilioVoiceWebhookSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
  Digits: z.string().optional(),
  ParentCallSid: z.string().optional(),
  CallDuration: z.string().optional(),
  RecordingUrl: z.string().optional(),
});

export type TwilioVoiceWebhookParams = z.infer<typeof twilioVoiceWebhookSchema>;
