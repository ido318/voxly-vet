/**
 * Enqueues SMS notifications from the dashboard into notifications_log.
 * Used by the approve/reject flow for pending_approval appointments.
 *
 * Templates are frozen — do not modify without Dana's approval. Templates and
 * Jerusalem-time math come from @tomer/shared — the single source of truth
 * also used by agent/src/services/sms.templates.ts (a thin re-export), so
 * app and agent can no longer drift the way they did before. As a second
 * safety net, tests/unit/sms-template-parity.test.ts still calls this
 * service and compares its output against the agent's templates verbatim —
 * treat that test failing as "the @tomer/shared re-export broke," not a
 * fixture to update.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import {
  resolveSmsTemplate,
  formatAppointmentDateTime,
  israelDateIso,
  israelDateAtHour,
  CLINIC_LOCATION,
  HOME_VISIT_LOCATION,
  type SmsTemplateKey,
  resolvePriceSegment,
  type PriceListEntry,
} from "@tomer/shared";

const VISIT_LABELS: Record<string, string> = {
  checkup: "בדיקה",
  vaccination: "חיסון",
  vaccine: "חיסון",
  neutering: "עיקור/סירוס",
  home_visit: "ביקור בית",
  phone_consultation: "ייעוץ טלפוני",
  followup: "מעקב",
  surgery: "ניתוח",
  other: "ביקור",
};

// The price used to be a hardcoded map here, whose keys did not even match the
// agent's: it had `vaccine`, `followup` and `surgery`, which are not
// appointment types, and lacked `urgent` and `consultation`, which are. So
// `urgent` was quoted 200 ₪ by the agent and fell through to a `?? "150 ₪"`
// fallback here — the same appointment, two prices, depending on which side
// enqueued the SMS. That fallback also invented a number nobody had
// configured and texted it to a client as a commitment.
//
// The clinic's editable price_list_items is the source now; see getPriceEntry
// below and resolvePriceSegment in @tomer/shared.

/** 14-day lead, 08:00 Asia/Jerusalem — matches the agent daily scan window. */
const VACCINATION_REMINDER_LEAD_DAYS = 14;
const VACCINATION_REMINDER_LOCAL_HOUR = 8;

export function vaccinationReminderScheduledFor(nextDueAt: string, now = new Date()): string {
  const dueIso = nextDueAt.slice(0, 10);
  const [year, month, day] = dueIso.split("-").map(Number);
  if (!year || !month || !day) return now.toISOString();

  const reminderDate = new Date(Date.UTC(year, month - 1, day - VACCINATION_REMINDER_LEAD_DAYS));
  const reminderIso = reminderDate.toISOString().slice(0, 10);
  const scheduled = israelDateAtHour(reminderIso, VACCINATION_REMINDER_LOCAL_HOUR);
  return scheduled.getTime() < now.getTime() ? now.toISOString() : scheduled.toISOString();
}

export interface ApproveNotificationParams {
  appointmentId: string;
  scheduledAt: string;
  durationMinutes: number;
  visitType: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
}

export interface RejectNotificationParams {
  appointmentId: string;
  scheduledAt: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
}

export interface DashboardChangeNotificationParams {
  clinicId: string;
  customerId: string;
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  templateKey: Extract<SmsTemplateKey, "reschedule_update" | "cancellation_update">;
  oldScheduledAt: string;
  newScheduledAt?: string;
  location: string;
}

export interface VaccinationReminderParams {
  vaccinationId: string;
  clinicId: string;
  customerId: string;
  phone: string;
  customerName: string;
  petName: string;
  vaccineName: string;
  nextDueAt: string;
}

export class DashboardNotificationsService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * The clinic's price for a visit type, or undefined when it has no row.
   *
   * agent_quotable is false for neutering: the 350 ₪ is real and Dana bills by
   * it, but the price depends on the individual animal, so she quotes it
   * herself. Reading the reason from the row means neither this service nor
   * the agent needs a hardcoded exception.
   */
  private async getPriceEntry(
    clinicId: string,
    visitType: string,
  ): Promise<PriceListEntry | undefined> {
    const { data, error } = await this.client
      .from("price_list_items")
      .select("default_price, agent_quotable")
      .eq("clinic_id", clinicId)
      .eq("visit_type", visitType)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    // On error, say the price will come from Dana rather than guess one.
    if (error || !data) return undefined;
    return {
      defaultPrice: Number(data.default_price),
      agentQuotable: data.agent_quotable !== false,
    };
  }

  /** Enqueue booking_confirmation + morning_reminder + arrival_reminder + post_visit_followup. */
  async enqueueApprovalNotifications(p: ApproveNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const now = new Date();
    const { dayName, date, time } = formatAppointmentDateTime(p.scheduledAt);
    const isHome = p.visitType === "home_visit";
    const location = isHome ? HOME_VISIT_LOCATION : CLINIC_LOCATION;
    const visitTypeLabel = VISIT_LABELS[p.visitType] ?? p.visitType;
    const price = resolvePriceSegment(await this.getPriceEntry(p.clinicId, p.visitType));

    const shared = {
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
    };

    const rows = [
      {
        ...shared,
        type:          "booking_confirmation",
        body:          resolveSmsTemplate("booking_confirmation", overrides.booking_confirmation, { customerName: p.customerName, petName: p.petName, dayName, date, time, location, visitType: visitTypeLabel, price }),
        scheduled_for: now.toISOString(),
      },
    ];

    const dateIso = israelDateIso(p.scheduledAt);
    const morning = israelDateAtHour(dateIso, 8);
    if (morning > now) {
      rows.push({
        ...shared,
        type:          "morning_reminder",
        body:          resolveSmsTemplate("morning_reminder", overrides.morning_reminder, { customerName: p.customerName, petName: p.petName, time, location, visitType: visitTypeLabel }),
        scheduled_for: morning.toISOString(),
      });
    }

    const arrivalReminderTime = new Date(new Date(p.scheduledAt).getTime() - 2 * 60 * 60_000);
    if (arrivalReminderTime > now) {
      rows.push({
        ...shared,
        type:          "arrival_reminder",
        body:          resolveSmsTemplate("arrival_reminder", overrides.arrival_reminder, { customerName: p.customerName, petName: p.petName, time, location, visitType: visitTypeLabel }),
        scheduled_for: arrivalReminderTime.toISOString(),
      });
    }

    const followupTime = new Date(new Date(p.scheduledAt).getTime() + p.durationMinutes * 60_000 + 24 * 60 * 60_000);
    rows.push({
      ...shared,
      type:          "post_visit_followup",
      body:          resolveSmsTemplate("post_visit_followup", overrides.post_visit_followup, { customerName: p.customerName, petName: p.petName }),
      scheduled_for: followupTime.toISOString(),
    });

    const { error } = await this.client.from("notifications_log").insert(rows);
    if (error) return err(AppError.externalProvider("Failed to enqueue approval notifications", error));
    return ok(undefined);
  }

  /** Enqueue cancellation_update for a rejected pending_approval appointment. */
  async enqueueRejectionNotification(p: RejectNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const { date } = formatAppointmentDateTime(p.scheduledAt);

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id:      p.clinicId,
      customer_id:    p.customerId,
      appointment_id: p.appointmentId,
      phone:          p.phone,
      status:         "pending",
      type:           "cancellation_update",
      body:           resolveSmsTemplate("cancellation_update", overrides.cancellation_update, { customerName: p.customerName, petName: p.petName, oldDate: date }),
      scheduled_for:  new Date().toISOString(),
    });

    if (error) return err(AppError.externalProvider("Failed to enqueue rejection notification", error));
    return ok(undefined);
  }

  /** Reads clinics.settings.smsTemplates for one clinic. Empty object (not an
   * error) if the clinic has no overrides or the row can't be read — the
   * caller always has the hardcoded default to fall back to. */
  async getSmsTemplateOverrides(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
    const { data, error } = await this.client
      .from("clinics")
      .select("settings")
      .eq("id", clinicId)
      .single();
    if (error || !data) return {};
    return (data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {};
  }

  /**
   * Enqueues the dashboard-initiated reschedule/cancellation SMS, respecting
   * any clinic override — replaces what appointments_notify_dashboard_change()
   * used to hardcode in SQL (see 20260915120000_remove_hardcoded_dashboard_sms.sql).
   */
  async enqueueDashboardChangeNotification(p: DashboardChangeNotificationParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const { date: oldDate } = formatAppointmentDateTime(p.oldScheduledAt);
    const newDateTime = p.newScheduledAt ? formatAppointmentDateTime(p.newScheduledAt) : null;

    const body = resolveSmsTemplate(p.templateKey, overrides[p.templateKey], {
      customerName: p.customerName,
      petName: p.petName,
      oldDate,
      newDate: newDateTime?.date,
      newTime: newDateTime?.time,
      location: p.location,
    });

    const { error } = await this.client.from("notifications_log").insert({
      clinic_id: p.clinicId,
      customer_id: p.customerId,
      appointment_id: p.appointmentId,
      phone: p.phone,
      status: "pending",
      type: p.templateKey,
      body,
      scheduled_for: new Date().toISOString(),
    });
    if (error) return err(AppError.externalProvider("Failed to enqueue dashboard change notification", error));
    return ok(undefined);
  }

  async enqueueVaccinationReminder(p: VaccinationReminderParams): Promise<Result<void>> {
    const overrides = await this.getSmsTemplateOverrides(p.clinicId);
    const { error } = await this.client.from("notifications_log").upsert(
      {
        clinic_id: p.clinicId,
        customer_id: p.customerId,
        vaccination_id: p.vaccinationId,
        phone: p.phone,
        status: "pending",
        type: "vaccination_reminder",
        body: resolveSmsTemplate("vaccination_reminder", overrides.vaccination_reminder, { customerName: p.customerName, petName: p.petName, vaccineName: p.vaccineName }),
        scheduled_for: vaccinationReminderScheduledFor(p.nextDueAt),
      },
      { onConflict: "vaccination_id,type", ignoreDuplicates: true },
    );

    if (error) return err(AppError.externalProvider("Failed to enqueue vaccination reminder", error));
    return ok(undefined);
  }
}
