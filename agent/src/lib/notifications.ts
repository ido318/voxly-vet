import { getSupabase } from "./supabase.js";
import { logger } from "./logger.js";
import {
  resolveSmsTemplate,
  formatAppointmentDateTime,
  israelDateIso,
  israelDateAtHour,
  israelDayHourMinute,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type BookingConfirmationData,
  type MorningReminderData,
  type SmsTemplateKey,
  NO_QUOTABLE_PRICE_TEXT,
  resolvePriceSegment,
  type PriceListEntry,
} from "@tomer/shared";
import { getVisitConfig, type VisitType } from "./appointments.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "booking_confirmation"
  | "morning_reminder"
  | "arrival_reminder"
  | "post_visit_followup"
  | "reschedule_update"
  | "cancellation_update"
  | "client_cancellation_confirmation";

// Price per visit type (displayed in booking_confirmation SMS). Whole segment,
// not just a number — so a visit whose price the agent may not quote can say
// so in the same slot instead of naming one.
//
// This used to be a hardcoded map here, with a near-copy in the dashboard
// that disagreed with it (urgent: 200 ₪ here, a `?? "150 ₪"` fallback there).
// The clinic's editable price_list_items is the source now; the wording for a
// price Tomer may not read out lives in @tomer/shared.
export const NO_FIXED_PRICE_TEXT = NO_QUOTABLE_PRICE_TEXT;

/**
 * The clinic's price for a visit type, or undefined when it has no row.
 *
 * agent_quotable is false for neutering: the 350 ₪ is real and Dana bills by
 * it, but the price depends on the individual animal, so she quotes it
 * herself. The column carries that reason so the SMS path does not need a
 * hardcoded exception.
 */
async function getPriceEntry(
  clinicId: string,
  visitType: VisitType,
): Promise<PriceListEntry | undefined> {
  const { data, error } = await getSupabase()
    .from("price_list_items")
    .select("default_price, agent_quotable")
    .eq("clinic_id", clinicId)
    .eq("visit_type", visitType)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    // Falling back to a number here would be inventing one. resolvePriceSegment
    // says the price will come from Dana instead, which is always true.
    logger.error({ err: error, visitType }, "price lookup failed — SMS will not quote a price");
    return undefined;
  }
  if (!data) return undefined;
  return {
    defaultPrice: Number(data.default_price),
    agentQuotable: data.agent_quotable !== false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Jerusalem timezone helpers — Intl-based math lives in @tomer/shared; the
// quiet-hours business rule (21:00–07:59) stays local to the agent.
// ─────────────────────────────────────────────────────────────────────────────

export { israelDateIso };

/** Returns true if `now` falls in quiet hours (21:00–07:59 Israel time). */
export function isQuietHours(now: Date): boolean {
  const { hour } = israelDayHourMinute(now);
  return hour >= 21 || hour < 8;
}

/** Alias kept for call sites that read "morning reminder = 08:00 Israel". */
export function morningReminderTime(dateIso: string): Date {
  return israelDateAtHour(dateIso, 8);
}

/**
 * If `now` is in quiet hours, returns 08:00 Israel time on the next morning.
 * Otherwise returns `now` unchanged.
 */
export function nextSendableTime(now: Date): Date {
  if (!isQuietHours(now)) return now;

  const todayIso = israelDateIso(now);
  const todayMorning = morningReminderTime(todayIso);
  if (todayMorning > now) return todayMorning;

  // todayMorning is already past → next morning
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return morningReminderTime(israelDateIso(tomorrow));
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS body builders
// ─────────────────────────────────────────────────────────────────────────────

async function buildBaseParams(
  clinicId: string,
  scheduledAt: string,
  visitType: VisitType,
  customerName: string,
  petName: string,
): Promise<BookingConfirmationData & MorningReminderData> {
  const { dayName, date, time } = formatAppointmentDateTime(scheduledAt);
  const config = getVisitConfig(visitType);
  return {
    customerName,
    petName,
    dayName,
    date,
    time,
    location: visitType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION,
    visitType: config.labelHe,
    price: resolvePriceSegment(await getPriceEntry(clinicId, visitType)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue (idempotent via UNIQUE(appointment_id, type))
// ─────────────────────────────────────────────────────────────────────────────

type EnqueueParams = {
  clinicId: string;
  customerId: string;
  appointmentId: string;
  phone: string;
  type: NotificationType;
  body: string;
  scheduledFor: Date;
};

/** Reads clinics.settings.smsTemplates for one clinic. Empty object if there's
 * no override or the row can't be read — callers always have the default text. */
async function getSmsTemplateOverrides(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
  const { data, error } = await getSupabase()
    .from("clinics")
    .select("settings")
    .eq("id", clinicId)
    .single();
  if (error || !data) return {};
  return (data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {};
}

export async function enqueueNotification(params: EnqueueParams): Promise<void> {
  const { error } = await getSupabase()
    .from("notifications_log")
    .upsert(
      {
        clinic_id:      params.clinicId,
        customer_id:    params.customerId,
        appointment_id: params.appointmentId,
        phone:          params.phone,
        type:           params.type,
        body:           params.body,
        scheduled_for:  params.scheduledFor.toISOString(),
        status:         "pending",
      },
      { onConflict: "appointment_id,type", ignoreDuplicates: true },
    );
  if (error) throw new Error(`enqueueNotification failed (${params.type}): ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level scheduling helpers
// ─────────────────────────────────────────────────────────────────────────────

export type BookingNotificationParams = {
  appointmentId: string;
  scheduledAt: string;   // ISO with timezone
  durationMinutes: number;
  visitType: VisitType;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

/** Enqueue booking_confirmation (now), morning_reminder (08:00 day-of), post_visit_followup (end+24h). */
export async function scheduleBookingNotifications(p: BookingNotificationParams): Promise<void> {
  const now = new Date();
  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const base = await buildBaseParams(p.clinicId, p.scheduledAt, p.visitType, p.customerName, p.petName);
  const shared = {
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
  };

  await enqueueNotification({
    ...shared,
    type:         "booking_confirmation",
    body:         resolveSmsTemplate("booking_confirmation", overrides.booking_confirmation, base),
    scheduledFor: now,
  });

  const appointmentDateIso = israelDateIso(new Date(p.scheduledAt));
  const morning = morningReminderTime(appointmentDateIso);
  if (morning > now) {
    await enqueueNotification({
      ...shared,
      type:         "morning_reminder",
      body:         resolveSmsTemplate("morning_reminder", overrides.morning_reminder, base),
      scheduledFor: morning,
    });
  }

  const arrivalReminderTime = new Date(new Date(p.scheduledAt).getTime() - 2 * 60 * 60_000);
  if (arrivalReminderTime > now) {
    await enqueueNotification({
      ...shared,
      type:         "arrival_reminder",
      body:         resolveSmsTemplate("arrival_reminder", overrides.arrival_reminder, base),
      scheduledFor: arrivalReminderTime,
    });
  }

  const followupTime = new Date(
    new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000,
  );
  await enqueueNotification({
    ...shared,
    type:         "post_visit_followup",
    body:         resolveSmsTemplate("post_visit_followup", overrides.post_visit_followup, {
      customerName: p.customerName,
      petName:      p.petName,
    }),
    scheduledFor: followupTime,
  });
}

/** Skip all pending future notifications for a given appointment. */
/**
 * Skips pending AND in-flight notifications for a cancelled/rescheduled
 * appointment. 'processing' rows are included because the atomic-claim
 * processor (notificationProcessor.ts) can be mid-send when a cancellation
 * comes in — without this, that row stays 'processing' and never gets
 * flagged, so the customer can receive an SMS seconds after cancelling.
 * This can't recall an SMS already handed to Twilio, but it does prevent
 * the processor's own post-send update from silently overwriting the
 * cancellation back to 'sent' (that update is itself guarded on
 * status='processing', so once this flips a row to 'skipped' first, the
 * processor's write becomes a no-op instead of clobbering it).
 */
export async function cancelFutureNotifications(
  appointmentId: string,
  clinicId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("notifications_log")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId)
    .eq("clinic_id", clinicId)
    .in("status", ["pending", "processing"]);
  if (error) throw new Error(`cancelFutureNotifications failed: ${error.message}`);
}

export type ClientCancellationParams = {
  appointmentId: string;
  scheduledAt: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

export type RescheduleNotificationParams = {
  appointmentId: string;
  oldScheduledAt: string;
  newScheduledAt: string;
  durationMinutes: number;
  visitType: VisitType;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
};

/**
 * Used when the dashboard reschedules an appointment via TypeScript code
 * (complementary to the DB trigger, which fires the same SQL path).
 * ON CONFLICT DO NOTHING ensures the trigger's row wins if it lands first.
 */
export async function enqueueRescheduleNotification(
  p: RescheduleNotificationParams,
): Promise<void> {
  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
  const { date: newDate, time: newTime } = formatAppointmentDateTime(p.newScheduledAt);
  const location = p.visitType === "home_visit" ? HOME_VISIT_LOCATION : CLINIC_LOCATION;

  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "reschedule_update",
    body:          resolveSmsTemplate("reschedule_update", overrides.reschedule_update, {
      customerName: p.customerName,
      petName:      p.petName,
      oldDate,
      newDate,
      newTime,
      location,
    }),
    scheduledFor: new Date(),
  });
}

/** Cancel future notifications and enqueue client_cancellation_confirmation immediately. */
export async function enqueueClientCancellationConfirmation(
  p: ClientCancellationParams,
): Promise<void> {
  await cancelFutureNotifications(p.appointmentId, p.clinicId);

  const overrides = await getSmsTemplateOverrides(p.clinicId);
  const { date } = formatAppointmentDateTime(p.scheduledAt);
  await enqueueNotification({
    clinicId:      p.clinicId,
    customerId:    p.customerId,
    appointmentId: p.appointmentId,
    phone:         p.phone,
    type:          "client_cancellation_confirmation",
    body:          resolveSmsTemplate("client_cancellation_confirmation", overrides.client_cancellation_confirmation, {
      customerName: p.customerName,
      petName:      p.petName,
      oldDate:      date,
    }),
    scheduledFor: new Date(),
  });
}
