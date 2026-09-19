import { getSupabase } from "./supabase.js";
import { resolveSmsTemplate, type SmsTemplateKey } from "@tomer/shared";
import { logger } from "./logger.js";
import { israelDateIso } from "./notifications.js";
import { getEnv } from "./env.js";

const REMINDER_WINDOW_DAYS = 14;

type DueVaccinationRow = {
  id: string;
  vaccine_name: string;
  next_due_at: string;
  pet: { name: string } | { name: string }[] | null;
  customer: { id: string; full_name: string; phone: string | null } | { id: string; full_name: string; phone: string | null }[] | null;
  clinic_id: string;
};

export type EnqueueVaccinationRemindersResult = {
  scanned: number;
  enqueued: number;
  skippedNoPhone: number;
  failed: number;
};

/**
 * Scans vaccinations due within REMINDER_WINDOW_DAYS and enqueues a
 * vaccination_reminder SMS for each one that doesn't already have one
 * (idempotent via the notifications_log_vaccination_type_unique constraint).
 */
export async function enqueueDueVaccinationReminders(): Promise<EnqueueVaccinationRemindersResult> {
  const result: EnqueueVaccinationRemindersResult = { scanned: 0, enqueued: 0, skippedNoPhone: 0, failed: 0 };

  const today = new Date();
  const todayIso = israelDateIso(today);
  const windowEnd = new Date(today.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60_000);
  const windowEndIso = israelDateIso(windowEnd);

  const { data, error } = await getSupabase()
    .from("vaccinations")
    .select(`
      id, vaccine_name, next_due_at, clinic_id,
      pet:pets!vaccinations_pet_clinic_fk(name),
      customer:customers!vaccinations_customer_clinic_fk(id, full_name, phone)
    `)
    // This agent serves one clinic. Without the filter the daily scan walked
    // every tenant's vaccinations and enqueued SMS on their behalf, from this
    // clinic's number.
    .eq("clinic_id", getEnv().AGENT_CLINIC_ID)
    .gte("next_due_at", todayIso)
    .lte("next_due_at", windowEndIso)
    .is("deleted_at", null)
    .returns<DueVaccinationRow[]>();

  if (error) throw new Error(`enqueueDueVaccinationReminders: failed to query vaccinations: ${error.message}`);
  if (!data) return result;

  result.scanned = data.length;

  const overridesCache = new Map<string, Partial<Record<SmsTemplateKey, string>>>();

  async function getOverridesFor(clinicId: string): Promise<Partial<Record<SmsTemplateKey, string>>> {
    if (overridesCache.has(clinicId)) return overridesCache.get(clinicId)!;
    const { data, error } = await getSupabase().from("clinics").select("settings").eq("id", clinicId).single();
    const overrides = (!error && data) ? ((data.settings?.smsTemplates as Partial<Record<SmsTemplateKey, string>> | undefined) ?? {}) : {};
    overridesCache.set(clinicId, overrides);
    return overrides;
  }

  for (const row of data) {
    const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    if (!pet || !customer) continue;

    if (!customer.phone) {
      result.skippedNoPhone++;
      logger.warn({ vaccinationId: row.id, customerId: customer.id }, "vaccination reminder skipped — no phone on file");
      continue;
    }

    const overrides = await getOverridesFor(row.clinic_id);
    const body = resolveSmsTemplate("vaccination_reminder", overrides.vaccination_reminder, {
      customerName: customer.full_name,
      petName: pet.name,
      vaccineName: row.vaccine_name,
    });

    const { error: insertErr } = await getSupabase()
      .from("notifications_log")
      .upsert(
        {
          clinic_id:       row.clinic_id,
          customer_id:     customer.id,
          vaccination_id:  row.id,
          phone:           customer.phone,
          type:            "vaccination_reminder",
          body,
          scheduled_for:   new Date().toISOString(),
          status:          "pending",
        },
        { onConflict: "vaccination_id,type", ignoreDuplicates: true },
      );

    if (insertErr) {
      result.failed++;
      logger.error({ vaccinationId: row.id, error: insertErr.message }, "failed to enqueue vaccination reminder");
      continue;
    }
    result.enqueued++;
  }

  return result;
}
