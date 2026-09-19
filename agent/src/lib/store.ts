import { getSupabase } from "./supabase.js";
import { getEnv } from "./env.js";
import { logger } from "./logger.js";
import {
  VisitType,
  getVisitConfig,
  effectiveDuration,
  getClinicHours,
  getDayNameHe,
  generateSlotsForVisitType,
  formatSlotSpokenHe,
  formatSlotOptionForTool,
  formatDateHe,
  isWithin14Days,
  bookingWindowRejection,
  isTooLateToCancel,
  maxBookingDateIso,
  toIso,
  toIsraelDateIso,
} from "./appointments.js";
import {
  scheduleBookingNotifications,
  cancelFutureNotifications,
  enqueueClientCancellationConfirmation,
} from "./notifications.js";
import { processNotifications } from "./notificationProcessor.js";
import { VALID_CALL_CATEGORIES } from "./callClassifier.js";
import { normaliseIsraeliPhone } from "@tomer/shared";

export type Pet = { id: string; name: string; species: string; breed: string | null };

export type Customer = {
  id: string;
  phone: string;
  full_name: string;
  pets: Pet[];
  // last_visit will be derived from the appointments table in a future phase
  notes: string | null;
};

// Pet summary including id — used by listCustomerPets, which (unlike
// findCustomerByPhone above) must let the calling LLM reference a specific
// pet by id in a later tool call (getPatientReminders, etc.).
export type PetSummary = { id: string; name: string; species: string };

export type ListCustomerPetsResult = {
  result: string;
  pets: PetSummary[];
};

export type EscalationEntry = {
  reason: string;
  urgency: number;
  conversation_id?: string | null;
  /** Who is calling, so the dashboard can show a name and a number to dial. */
  caller_phone?: string | null;
  customer_id?: string | null;
  pet_id?: string | null;
  /**
   * Structured triage context — decision, matched_flags, after_hours and the
   * caller's full symptom description. Kept out of `notes`, which is what a
   * human types when resolving: the old code wrote this JSON into `notes`, and
   * resolving the escalation overwrote it.
   */
  context?: Record<string, unknown> | null;
};

/**
 * Normalise an Israeli phone to E.164, or null when the input cannot be one.
 *
 * Re-exports the single source of truth in @tomer/shared — kept under this
 * name so the call sites below (and lookup-customer.test.ts) don't change.
 *
 * This used to return `+${digits}`, which meant "", "unknown" and "aaaaa" all
 * normalised to the string "+" and were stored as real phone numbers. It now
 * returns null instead, so every caller has to decide what to do with a
 * number it can neither text nor call back.
 */
export function normalisePhone(raw: string): string | null {
  return normaliseIsraeliPhone(raw);
}

const INACTIVE_CUSTOMER_RESULT =
  "מספר הטלפון הזה רשום אצלנו אבל הכרטיס אינו פעיל. ד\"ר דנה תחזור אליכם לבדוק את זה.";

/** What Tomer says when the number he was given is not usable. */
const INVALID_PHONE_RESULT =
  "מספר הטלפון שנמסר אינו תקין. אפשר לחזור עליו שוב, ספרה-ספרה?";

export async function findCustomerByPhone(
  phone: string,
): Promise<Customer | null> {
  const normalised = normalisePhone(phone);
  if (!normalised) return null;
  const env = getEnv();

  const { data, error } = await getSupabase()
    .from("customers")
    .select("id, phone, full_name, notes")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", normalised)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`supabase lookup failed: ${error.message}`);
  if (!data) return null;

  const row = data as {
    id: string;
    phone: string;
    full_name: string;
    notes: string | null;
  };

  // Queried separately (rather than via a `pets(...)` embed on the customers
  // query above) so deleted_at can actually be filtered on the pets side —
  // PostgREST embeds don't apply the parent query's filters to child rows.
  // Same fix as listCustomerPets below; this function predates that one and
  // was missed when the bug was first found and fixed there.
  const { data: petsData, error: petsErr } = await getSupabase()
    .from("pets")
    .select("id, name, species, breed")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", row.id)
    .is("deleted_at", null);

  if (petsErr) throw new Error(`supabase lookup failed: ${petsErr.message}`);

  const pets = (petsData ?? []).flatMap((petRow) => {
    const id = extractId(petRow);
    const name = extractString(petRow, "name");
    const species = extractString(petRow, "species");
    if (!id || !name || !species) return [];
    return [{
      id,
      name,
      species,
      breed: extractString(petRow, "breed"),
    }];
  });

  return {
    id: row.id,
    phone: row.phone,
    full_name: row.full_name,
    notes: row.notes,
    pets,
  };
}

export async function addEscalation(entry: EscalationEntry): Promise<void> {
  const env = getEnv();
  // Resolve the caller to a customer when we can, so the dashboard card can
  // show a name rather than a bare phone number. Best-effort: an unknown
  // number still produces a usable escalation.
  const callerPhone = entry.caller_phone ? normaliseIsraeliPhone(entry.caller_phone) : null;
  const customerId =
    entry.customer_id ?? (callerPhone ? await safeFindCustomerIdByPhone(callerPhone) : null);

  const { error } = await getSupabase().from("escalations").insert({
    clinic_id: env.AGENT_CLINIC_ID,
    reason: entry.reason,
    urgency: entry.urgency,
    elevenlabs_conversation_id: entry.conversation_id ?? null,
    caller_phone: callerPhone,
    customer_id: customerId,
    pet_id: entry.pet_id ?? null,
    context: entry.context ?? {},
  });
  if (error) throw new Error(`supabase escalation insert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  appointment_type: string;
  duration_minutes: number;
  customer_name: string;
  pet_name: string;
  customer_id: string;
};

function extractId(row: unknown): string | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)["id"];
    if (typeof val === "string") return val;
  }
  return null;
}

function extractString(row: unknown, key: string): string | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return null;
}

function extractNumber(row: unknown, key: string): number | null {
  if (row !== null && typeof row === "object") {
    const val = (row as Record<string, unknown>)[key];
    if (typeof val === "number") return val;
  }
  return null;
}

function isSameAppointmentSlot(a: string, b: string): boolean {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  return !Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs === bMs;
}

function extractNestedString(row: unknown, parent: string, key: string): string | null {
  if (row !== null && typeof row === "object") {
    const nested = (row as Record<string, unknown>)[parent];
    if (nested !== null && typeof nested === "object") {
      const val = (nested as Record<string, unknown>)[key];
      if (typeof val === "string") return val;
    }
  }
  return null;
}

function firstTrimmedString(row: unknown, keys: string[]): string | null {
  if (row === null || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  for (const key of keys) {
    const val = rec[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function extractFromWebhookPayload(payload: Record<string, unknown>, keys: string[]): string | null {
  const direct = firstTrimmedString(payload, keys);
  if (direct) return direct;

  const fromMetadata = firstTrimmedString(payload["metadata"], keys);
  if (fromMetadata) return fromMetadata;

  const initiation = payload["conversation_initiation_client_data"];
  if (initiation !== null && typeof initiation === "object") {
    const fromVars = firstTrimmedString(
      (initiation as Record<string, unknown>)["dynamic_variables"],
      keys,
    );
    if (fromVars) return fromVars;
  }

  return null;
}

function extractTwilioCallSid(payload: Record<string, unknown>): string | null {
  return extractFromWebhookPayload(payload, ["twilio_call_sid"]);
}

/** Native ElevenLabs inbound uses system__caller_id in dynamic_variables; our TwiML path uses caller_number. */
export function extractCallerPhone(payload: Record<string, unknown>): string | null {
  return extractFromWebhookPayload(payload, ["caller_number", "system__caller_id", "caller_id"]);
}

async function findCustomerIdByPhone(phone: string): Promise<string | null> {
  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("customers")
    .select("id")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", phone)
    .is("deleted_at", null)
    // Matches findCustomerByPhone, which has always filtered on status. Without
    // it, booking/cancelling/waitlist reached a deactivated customer through
    // createOrFindCustomer while a lookup on the same number said "unknown".
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`findCustomerIdByPhone failed: ${error.message}`);
  return extractId(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The free slots for a date and visit type, as ISO instants. Empty when the
 * date is outside the 14-day window, on a closed day, or fully booked.
 *
 * checkAvailability below renders these into one Hebrew string aimed at the
 * LLM. Code that needs the slots themselves must use this function: the
 * urgent-callback path used to regex `\b(\d{2}:\d{2})\b` out of that string
 * and, because formatSlotSpokenHe writes a 12-hour hour with no leading zero,
 * matched the seconds inside the ISO instead — announcing "היום ב-00:00" for a
 * 13:00 slot. On a Saturday it matched 08:00 out of the opening-hours sentence
 * in the "clinic is closed" message and offered a slot on a closed day.
 */
export async function getFreeSlots(
  dateIso: string,
  visitType: VisitType,
): Promise<string[]> {
  if (!isWithin14Days(dateIso)) return [];

  const hours = getClinicHours(dateIso);
  if (!hours) return [];

  const env = getEnv();

  // 3. Calendar blocks — unavailable ranges for the requested date
  const dayStart = toIso(dateIso, 0, 0);
  const dayEnd   = toIso(dateIso, 23, 59);

  const { data: blocks, error: blockErr } = await getSupabase()
    .from("calendar_blocks")
    .select("start_at, end_at, reason")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  if (blockErr) throw new Error(`calendar_blocks query failed: ${blockErr.message}`);

  // 4. Fetch existing appointments for the day (scheduled_at + end_at)
  const { data: appts, error: apptErr } = await getSupabase()
    .from("appointments")
    .select("scheduled_at, end_at")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    // Must match appointments_no_active_overlap's WHERE clause exactly
    // (20260831102335_phase1_database_core_alignment.sql) — otherwise Tomer
    // can offer a slot the DB exclusion constraint will then reject.
    .in("status", ["scheduled", "confirmed", "pending_approval", "checked_in", "in_visit"])
    .is("deleted_at", null)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (apptErr) throw new Error(`checkAvailability query failed: ${apptErr.message}`);

  const bookedRanges = (appts ?? []).flatMap((r) => {
    const start = extractString(r, "scheduled_at");
    const end   = extractString(r, "end_at");
    return start && end ? [{ start, end }] : [];
  });

  const blockedRanges = (blocks ?? []).flatMap((r) => {
    const start = extractString(r, "start_at");
    const end = extractString(r, "end_at");
    return start && end ? [{ start, end }] : [];
  });

  // 5. Generate free slots for the requested visit type
  return generateSlotsForVisitType(dateIso, hours, visitType, [
    ...bookedRanges,
    ...blockedRanges,
  ]);
}

/**
 * The same availability, rendered for the LLM. Wording and the
 * `scheduled_at=` marker are load-bearing — tomer-system-prompt.md tells the
 * model to copy that value verbatim when booking — so this string's shape
 * must not change.
 */
export async function checkAvailability(
  dateIso: string,
  visitType: VisitType,
): Promise<string> {
  if (!isWithin14Days(dateIso)) {
    const maxDate = maxBookingDateIso();
    return `ניתן לקבוע תורים עד ${formatDateHe(maxDate)} בלבד (14 יום קדימה).`;
  }

  if (!getClinicHours(dateIso)) {
    return "המרפאה סגורה בשבת. אפשר לקבוע תור ביום ראשון עד חמישי 08:00-20:00 או ביום שישי 08:30-13:00.";
  }

  const freeSlots = await getFreeSlots(dateIso, visitType);

  const config = getVisitConfig(visitType);
  const typeLabelHe = config.labelHe;

  if (freeSlots.length === 0) {
    return `אין חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (${getDayNameHe(dateIso)}). נסה תאריך אחר.`;
  }

  const labels = freeSlots.map(formatSlotOptionForTool).join(", ");
  return (
    `חלונות פנויים ל${typeLabelHe} ב-${formatDateHe(dateIso)} (יום ${getDayNameHe(dateIso)}): ${labels}. ` +
    "לקביעת תור חובה להשתמש בערך scheduled_at המדויק מאחת האופציות, כולל אזור הזמן. " +
    "זו רשימה מלאה למטרות התאמה בלבד — אסור להקריא אותה ללקוח כמות שהיא. " +
    "הצע בקול רק את 2-3 השעות המוקדמות ביותר, אלא אם הלקוח ציין העדפת זמן אחרת (בוקר/צהריים/אחה\"צ) — " +
    "ואז הצע 2-3 שעות מהטווח הזה בלבד."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Book appointment
// ─────────────────────────────────────────────────────────────────────────────

export type BookAppointmentParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  pet_breed?: string | null;
  scheduled_at: string;
  visit_type: VisitType;
  reason?: string;
  twilio_call_sid?: string;
  elevenlabs_conversation_id?: string;
};

export async function bookAppointment(params: BookAppointmentParams): Promise<string> {
  const windowRejection = bookingWindowRejection(params.scheduled_at, params.visit_type);
  if (windowRejection) return windowRejection;

  const env = getEnv();
  const phone = normalisePhone(params.phone);
  if (!phone) return INVALID_PHONE_RESULT;
  const config = getVisitConfig(params.visit_type);
  const durMin = effectiveDuration(params.visit_type);
  const status = config.requiresApproval ? "pending_approval" : "scheduled";

  let customerId: string;
  let petId: string;
  try {
    ({ customerId } = await createOrFindCustomer(phone, params.customer_name));
    ({ petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species, params.pet_breed));
  } catch (err) {
    if (err instanceof InactiveCustomerError) return INACTIVE_CUSTOMER_RESULT;
    throw err;
  }

  const { data, error } = await getSupabase()
    .from("appointments")
    .insert({
      clinic_id:        env.AGENT_CLINIC_ID,
      customer_id:      customerId,
      pet_id:           petId,
      appointment_type: params.visit_type,
      status,
      source:           "phone",
      scheduled_at:     params.scheduled_at,
      duration_minutes: durMin,
      reason:           params.reason ?? null,
      changed_via:      "agent",
    })
    .select("id, scheduled_at")
    .single();

  if (error) {
    if (error.code === "23P01" || error.message.includes("appointments_no_active_overlap")) {
      logger.warn(
        {
          phone: params.phone,
          visitType: params.visit_type,
          scheduledAt: params.scheduled_at,
          error,
        },
        "bookAppointment: slot overlap, booking was not created",
      );

      try {
        const dateIso = params.scheduled_at.slice(0, 10);
        const availability = await checkAvailability(dateIso, params.visit_type);
        return `השעה הזו כבר תפוסה. ${availability}`;
      } catch (availabilityErr) {
        logger.error(
          { err: availabilityErr, scheduledAt: params.scheduled_at, visitType: params.visit_type },
          "bookAppointment: failed to refresh availability after overlap",
        );
        return "השעה הזו כבר תפוסה. בחר/י שעה אחרת מהחלונות הפנויים.";
      }
    }
    logger.error(
      { err: error, scheduledAt: params.scheduled_at, visitType: params.visit_type },
      "bookAppointment: appointment insert failed",
    );
    throw new Error(`bookAppointment failed: ${error.message}`);
  }

  const appointmentId = extractId(data);
  const scheduledAt   = typeof data.scheduled_at === "string" ? data.scheduled_at : params.scheduled_at;
  const slotLabel     = formatSlotSpokenHe(scheduledAt);
  const dateLabel     = toIsraelDateIso(new Date(scheduledAt));

  if (appointmentId) {
    await linkVoiceCall({
      twilioCallSid: params.twilio_call_sid,
      conversationId: params.elevenlabs_conversation_id,
      customerId,
      petId,
      appointmentId,
    });
  }

  // Fire-and-forget SMS notifications — only for confirmed bookings.
  // pending_approval (neutering) must NOT create notifications here;
  // they are created by the dashboard approve flow instead.
  if (appointmentId && !config.requiresApproval) {
    void scheduleBookingNotifications({
      appointmentId,
      scheduledAt,
      durationMinutes: durMin,
      visitType:       params.visit_type,
      clinicId:        env.AGENT_CLINIC_ID,
      customerId,
      phone,
      customerName:    params.customer_name,
      petName:         params.pet_name,
    })
      .then(() => processNotifications({ appointmentId }))
      .catch((err: unknown) => logger.error({ err, appointmentId }, "SMS book fire-and-forget failed"));
  }

  if (config.requiresApproval) {
    return (
      `בקשת התור ל${config.labelHe} נרשמה ל-${formatDateHe(dateLabel)} בשעה ${slotLabel} ` +
      `עבור ${params.pet_name}. התור ממתין לאישור דנה.`
    );
  }

  return (
    `תור נקבע ל-${formatDateHe(dateLabel)} בשעה ${slotLabel} עבור ${params.pet_name}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel / reschedule
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelAppointment(phone: string, scheduledAt: string): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);
  if (!normalised) return INVALID_PHONE_RESULT;

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const appt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, scheduledAt);
  if (!appt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  const lateCancellation = isTooLateToCancel(appt.scheduled_at);
  const newStatus = lateCancellation ? "late_cancellation" : "cancelled";

  const { error: cancelErr } = await getSupabase()
    .from("appointments")
    .update({
      status:       newStatus,
      cancelled_at: new Date().toISOString(),
      changed_via:  "agent",
    })
    .eq("id", appt.id);

  if (cancelErr) throw new Error(`cancelAppointment update failed: ${cancelErr.message}`);

  // Fire-and-forget: cancel future notifications + send client confirmation SMS
  void enqueueClientCancellationConfirmation({
    appointmentId: appt.id,
    scheduledAt:   appt.scheduled_at,
    clinicId:      env.AGENT_CLINIC_ID,
    customerId:    appt.customer_id,
    phone:         normalised,
    customerName:  appt.customer_name,
    petName:       appt.pet_name,
  })
    .then(() => processNotifications({ appointmentId: appt.id }))
    .catch((err: unknown) => logger.error({ err, appointmentId: appt.id }, "SMS cancel fire-and-forget failed"));

  const slotLabel = formatSlotSpokenHe(appt.scheduled_at);

  if (lateCancellation) {
    return (
      `התור בשעה ${slotLabel} סומן כביטול מאוחר (פחות מ-4 שעות לפני). ` +
      `לפי המדיניות יחויב במלואו.`
    );
  }

  return `✅ התור בשעה ${slotLabel} בוטל בהצלחה.`;
}

export async function rescheduleAppointment(
  phone: string,
  currentScheduledAt: string,
  newScheduledAt: string,
  visitType?: VisitType,
): Promise<string> {
  const env = getEnv();
  const normalised = normalisePhone(phone);
  if (!normalised) return INVALID_PHONE_RESULT;

  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return "לא מצאנו לקוח עם מספר הטלפון הזה.";

  const oldAppt = await findActiveAppointmentNear(env.AGENT_CLINIC_ID, customerId, currentScheduledAt);
  if (!oldAppt) return "לא מצאנו תור פעיל בשעה הזו. ייתכן שכבר בוטל.";

  if (isTooLateToCancel(oldAppt.scheduled_at)) {
    return "לא ניתן להזיז תור פחות מ-4 שעות לפני מועדו. לסיוע נוסף — פנה ישירות לדנה.";
  }

  // Resolve effective duration: prefer explicit visitType, fallback to stored type
  const resolvedType = (visitType ?? oldAppt.appointment_type) as VisitType;
  const durMin = effectiveDuration(resolvedType);

  const windowRejection = bookingWindowRejection(newScheduledAt, resolvedType);
  if (windowRejection) return windowRejection;

  if (isSameAppointmentSlot(oldAppt.scheduled_at, newScheduledAt)) {
    const nextStatus = getVisitConfig(resolvedType).requiresApproval ? "pending_approval" : "scheduled";
    const { error: updateErr } = await getSupabase()
      .from("appointments")
      .update({
        appointment_type: resolvedType,
        duration_minutes: durMin,
        status:           nextStatus,
        changed_via:      "agent",
      })
      .eq("id", oldAppt.id);

    if (updateErr) {
      if (updateErr.code === "23P01" || updateErr.message.includes("appointments_no_active_overlap")) {
        return "אי אפשר לשנות לסוג הביקור הזה באותה שעה כי משך התור החדש מתנגש עם תור אחר.";
      }
      throw new Error(`rescheduleAppointment type update failed: ${updateErr.message}`);
    }

    return `✅ סוג התור עודכן ל${getVisitConfig(resolvedType).labelHe} בשעה ${formatSlotSpokenHe(oldAppt.scheduled_at)}.`;
  }

  const { data: rpcData, error: rpcErr } = await getSupabase().rpc("reschedule_appointment", {
    p_clinic_id:          env.AGENT_CLINIC_ID,
    p_old_appointment_id: oldAppt.id,
    p_new_scheduled_at:   newScheduledAt,
    p_duration_minutes:   durMin,
  });

  if (rpcErr) {
    if (rpcErr.message.includes("appointments_no_active_overlap") || rpcErr.code === "23P01") {
      return "השעה החדשה כבר תפוסה. בחר/י שעה אחרת.";
    }
    throw new Error(`rescheduleAppointment rpc failed: ${rpcErr.message}`);
  }

  const newAppointmentId = typeof rpcData === "string" ? rpcData : null;

  // Set changed_via on the new appointment and fire SMS notifications
  if (newAppointmentId) {
    void (async () => {
      try {
        await getSupabase()
          .from("appointments")
          .update({ changed_via: "agent" })
          .eq("id", newAppointmentId);

        await cancelFutureNotifications(oldAppt.id, env.AGENT_CLINIC_ID);
        await scheduleBookingNotifications({
          appointmentId:   newAppointmentId,
          scheduledAt:     newScheduledAt,
          durationMinutes: durMin,
          visitType:       resolvedType,
          clinicId:        env.AGENT_CLINIC_ID,
          customerId:      oldAppt.customer_id,
          phone:           normalised,
          customerName:    oldAppt.customer_name,
          petName:         oldAppt.pet_name,
        });
        await processNotifications({ appointmentId: newAppointmentId });
      } catch (err) {
        logger.error({ err, newAppointmentId }, "SMS reschedule fire-and-forget failed");
      }
    })();
  }

  const oldLabel = formatSlotSpokenHe(oldAppt.scheduled_at);
  const newLabel = formatSlotSpokenHe(newScheduledAt);
  const newDate  = newScheduledAt.slice(0, 10);
  return `✅ התור הוזז בהצלחה מ-${oldLabel} ל-${formatDateHe(newDate)} בשעה ${newLabel}.`;
}

const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "pending_approval",
  "checked_in",
  "in_visit",
] as const;

export type CustomerAppointmentSummary = {
  scheduled_at: string;
  visit_type: string;
  pet_name: string;
  status: string;
};

export async function listCustomerAppointments(
  phone: string,
): Promise<{ result: string; appointments: CustomerAppointmentSummary[] }> {
  const env = getEnv();
  const normalised = normalisePhone(phone);
  if (!normalised) return { result: INVALID_PHONE_RESULT, appointments: [] };
  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) {
    return { result: "לא מצאנו לקוח עם מספר הטלפון הזה.", appointments: [] };
  }

  const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("appointments")
    .select("scheduled_at, appointment_type, status, pets(name)")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES])
    .is("deleted_at", null)
    .gte("scheduled_at", windowStart)
    .order("scheduled_at", { ascending: true })
    .limit(8);

  if (error) throw new Error(`listCustomerAppointments failed: ${error.message}`);

  const appointments: CustomerAppointmentSummary[] = (data ?? []).flatMap((row) => {
    const scheduled_at = extractString(row, "scheduled_at");
    if (!scheduled_at) return [];
    const visit_type = extractString(row, "appointment_type") ?? "other";
    const status = extractString(row, "status") ?? "scheduled";
    const pet_name = extractNestedString(row, "pets", "name") ?? "";
    return [{ scheduled_at, visit_type, pet_name, status }];
  });

  if (appointments.length === 0) {
    return { result: "אין תורים פעילים קרובים למספר הזה.", appointments: [] };
  }

  const lines = appointments.map((appt) => {
    const dateLabel = formatDateHe(toIsraelDateIso(new Date(appt.scheduled_at)));
    const timeLabel = formatSlotSpokenHe(appt.scheduled_at);
    const typeLabel = getVisitConfig(appt.visit_type as VisitType).labelHe;
    const petBit = appt.pet_name ? ` עבור ${appt.pet_name}` : "";
    return `${dateLabel} בשעה ${timeLabel} — ${typeLabel}${petBit} (scheduled_at=${appt.scheduled_at})`;
  });

  return {
    result: `תורים פעילים: ${lines.join("; ")}`,
    appointments,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Waitlist
// ─────────────────────────────────────────────────────────────────────────────

export type JoinWaitlistParams = {
  phone: string;
  customer_name: string;
  pet_name: string;
  pet_species: string;
  pet_breed?: string | null;
  visit_type: VisitType;
  preferred_start?: string; // YYYY-MM-DD
  preferred_end?: string;   // YYYY-MM-DD
  notes?: string;
};

export async function joinWaitlist(params: JoinWaitlistParams): Promise<string> {
  const env = getEnv();
  const phone = normalisePhone(params.phone);
  if (!phone) return INVALID_PHONE_RESULT;

  let customerId: string;
  let petId: string;
  try {
    ({ customerId } = await createOrFindCustomer(phone, params.customer_name));
    ({ petId } = await createOrFindPet(customerId, params.pet_name, params.pet_species, params.pet_breed));
  } catch (err) {
    if (err instanceof InactiveCustomerError) return INACTIVE_CUSTOMER_RESULT;
    throw err;
  }

  const { error } = await getSupabase().from("waitlist").insert({
    clinic_id:       env.AGENT_CLINIC_ID,
    customer_id:     customerId,
    pet_id:          petId,
    visit_type:      params.visit_type,
    preferred_start: params.preferred_start ?? null,
    preferred_end:   params.preferred_end   ?? null,
    status:          "waiting",
    notes:           params.notes ?? null,
  });

  if (error) throw new Error(`joinWaitlist insert failed: ${error.message}`);

  const config = getVisitConfig(params.visit_type);
  return (
    `✅ ${params.pet_name} נרשמ/ה לרשימת ההמתנה ל${config.labelHe}. ` +
    `דנה תצור קשר כשיפתח מקום. ` +
    `אם מצב בעל החיים מחמיר — פנה/י לבית חולים וטרינרי.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient lookup (Voice SOAP Generator support)
//
// These four tools let Tomer answer follow-up questions about a specific
// pet during a call (vaccination reminders, chronic conditions, last visit's
// plan). Every one of the three pet-scoped lookups below (all but
// listCustomerPets) MUST go through verifyPetOwnership first — see the
// "Private helpers" section — so a confused/hallucinating LLM can never use
// a stale or wrong pet_id from an earlier turn or a different call to read
// another customer's pet data.
// ─────────────────────────────────────────────────────────────────────────────

const REMINDER_WINDOW_DAYS = 60;

export async function listCustomerPets(phone: string): Promise<ListCustomerPetsResult> {
  const normalised = normalisePhone(phone);
  if (!normalised) return { result: INVALID_PHONE_RESULT, pets: [] };
  const env = getEnv();

  const { data: customerRow, error: customerErr } = await getSupabase()
    .from("customers")
    .select("id, full_name")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", normalised)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (customerErr) throw new Error(`listCustomerPets customer query failed: ${customerErr.message}`);

  if (!customerRow) {
    return {
      result: "לקוח לא מוכר במערכת. לא נמצאו חיות רשומות למספר הטלפון הזה.",
      pets: [],
    };
  }

  const customerId = extractId(customerRow);
  const fullName = extractString(customerRow, "full_name") ?? "";

  // customers.id is a NOT NULL primary key, so this should be unreachable in
  // practice — but fail safely (no pets) rather than issuing a pets query
  // filtered on a null customer_id.
  if (!customerId) {
    return { result: `לא נמצאו חיות רשומות עבור ${fullName}.`, pets: [] };
  }

  // Queried separately (rather than via a `pets(...)` embed on the customers
  // query above) so deleted_at can actually be filtered on the pets side —
  // PostgREST embeds don't apply the parent query's filters to child rows.
  const { data: petsData, error: petsErr } = await getSupabase()
    .from("pets")
    .select("id, name, species")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (petsErr) throw new Error(`listCustomerPets pets query failed: ${petsErr.message}`);

  const pets = (petsData ?? []) as PetSummary[];

  if (pets.length === 0) {
    return { result: `לא נמצאו חיות רשומות עבור ${fullName}.`, pets: [] };
  }

  if (pets.length === 1) {
    const p = pets[0]!;
    return {
      result: `החיה הרשומה עבור ${fullName} היא ${p.name} (${p.species}), מזהה pet_id: ${p.id}.`,
      pets,
    };
  }

  const listHe = pets.map((p) => `${p.name} (${p.species}, pet_id: ${p.id})`).join(", ");
  return {
    result:
      `ל${fullName} יש כמה חיות רשומות: ${listHe}. ` +
      "יש לשאול לאיזו חיה מתייחסת הפנייה, ולהשתמש ב-pet_id המתאים בקריאות הבאות.",
    pets,
  };
}

export async function getPatientReminders(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("vaccinations")
    .select("vaccine_name, next_due_at")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .not("next_due_at", "is", null)
    .order("next_due_at", { ascending: true });

  if (error) throw new Error(`getPatientReminders failed: ${error.message}`);

  const rows = (data ?? []) as Array<{ vaccine_name: string; next_due_at: string }>;
  if (rows.length === 0) {
    return `אין תזכורות חיסון ממתינות עבור ${pet.name}.`;
  }

  // next_due_at is a plain `date` column (no time/timezone component), so
  // "YYYY-MM-DD" string comparison against today's Israel-local date is both
  // correct and simpler than round-tripping through Date/ms.
  const todayIso = toIsraelDateIso(new Date());
  const windowEndMs =
    new Date(toIso(todayIso, 0, 0)).getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const overdue: string[] = [];
  const upcoming: string[] = [];

  for (const row of rows) {
    if (!row.next_due_at) continue;
    const dueDateIso = row.next_due_at.slice(0, 10);
    const dateLabel = formatDateHe(dueDateIso);

    if (dueDateIso < todayIso) {
      overdue.push(`${row.vaccine_name} (${dateLabel})`);
    } else if (new Date(toIso(dueDateIso, 0, 0)).getTime() <= windowEndMs) {
      upcoming.push(`${row.vaccine_name} (${dateLabel})`);
    }
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    return `אין תזכורות חיסון קרובות עבור ${pet.name} בטווח הקרוב.`;
  }

  const parts: string[] = [];
  if (overdue.length > 0) {
    parts.push(`חיסונים באיחור עבור ${pet.name}: ${overdue.join(", ")}.`);
  }
  if (upcoming.length > 0) {
    parts.push(`חיסונים קרובים עבור ${pet.name}: ${upcoming.join(", ")}.`);
  }

  return parts.join(" ");
}

export async function getPatientChronicConditions(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();

  const { data: petRow, error: petErr } = await getSupabase()
    .from("pets")
    .select("chronic_conditions")
    .eq("id", pet.id)
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .maybeSingle();
  if (petErr) throw new Error(`getPatientChronicConditions pet query failed: ${petErr.message}`);

  const chronicText = extractString(petRow, "chronic_conditions");

  const { data: recordRow, error: recordErr } = await getSupabase()
    .from("medical_records")
    .select("active_problem_list")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (recordErr) {
    throw new Error(`getPatientChronicConditions medical_records query failed: ${recordErr.message}`);
  }

  const conditionNames = extractProblemList(recordRow)
    .map((entry) => entry.condition)
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0);

  const hasChronicText = !!chronicText?.trim();
  const hasProblems = conditionNames.length > 0;

  if (!hasChronicText && !hasProblems) {
    return `אין רשומות של מצבים כרוניים עבור ${pet.name}.`;
  }

  const parts: string[] = [];
  if (hasChronicText) {
    parts.push(`מצבים כרוניים ידועים עבור ${pet.name}: ${chronicText!.trim()}.`);
  }
  if (hasProblems) {
    parts.push(`רשימת בעיות פעילה: ${conditionNames.join(", ")}.`);
  }

  return parts.join(" ");
}

export async function getLastVisitPlan(phone: string, petId: string): Promise<string> {
  const pet = await verifyPetOwnership(phone, petId);
  if (!pet) return PET_NOT_FOUND_HE;

  const env = getEnv();
  const visitIds = await findPetVisitIds(env.AGENT_CLINIC_ID, pet.id);

  if (visitIds.length > 0) {
    const { data, error } = await getSupabase()
      .from("medical_notes")
      .select("plan, created_at")
      .eq("clinic_id", env.AGENT_CLINIC_ID)
      .in("visit_id", visitIds)
      .eq("note_type", "soap_full")
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("plan", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`getLastVisitPlan notes query failed: ${error.message}`);

    const plan = extractString(data, "plan");
    if (plan && plan.trim()) {
      const createdAt = extractString(data, "created_at");
      const dateLabel = createdAt ? formatDateHe(toIsraelDateIso(new Date(createdAt))) : null;
      return dateLabel
        ? `בביקור האחרון, בתאריך ${dateLabel}, ד"ר דנה קבעה את התוכנית הבאה עבור ${pet.name}: ${plan.trim()}`
        : `בביקור האחרון ד"ר דנה קבעה את התוכנית הבאה עבור ${pet.name}: ${plan.trim()}`;
    }
  }

  // Fallback: no approved soap_full plan on record — try the most recent
  // visit's manual/AI summary instead. Never fall back to a draft note's
  // plan — an unapproved plan may still change before Dana signs off on it.
  const { data: visitRow, error: visitErr } = await getSupabase()
    .from("visits")
    .select("manual_visit_summary, ai_visit_summary")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("pet_id", pet.id)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (visitErr) throw new Error(`getLastVisitPlan visit fallback query failed: ${visitErr.message}`);

  const summary =
    extractString(visitRow, "manual_visit_summary") ?? extractString(visitRow, "ai_visit_summary");

  if (summary && summary.trim()) {
    return `לא נמצאה תוכנית טיפול מאושרת מהביקור האחרון עבור ${pet.name}. תקציר הביקור האחרון: ${summary.trim()}`;
  }

  return `אין תוכנית טיפול שמורה עבור ${pet.name}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice calls
// ─────────────────────────────────────────────────────────────────────────────

export type SaveVoiceCallEnrichment = {
  transcript?: unknown[] | null;
  aiSummary?: string | null;
  callCategory?: "operation" | "information" | null;
  recordingStoragePath?: string | null;
};

export type SaveIncomingVoiceCallParams = {
  twilioCallSid: string;
  fromNumber: string;
  toNumber: string;
  status: "in_progress";
  metadata: Record<string, unknown>;
};

export async function saveIncomingVoiceCall(
  params: SaveIncomingVoiceCallParams,
): Promise<void> {
  const env = getEnv();
  const { error } = await getSupabase()
    .from("voice_calls")
    .upsert(
      {
        clinic_id:        env.AGENT_CLINIC_ID,
        direction:        "inbound",
        status:           params.status,
        from_number:      params.fromNumber,
        to_number:        params.toNumber,
        twilio_call_sid:  params.twilioCallSid,
        agent_name:       "tomer",
        metadata:         params.metadata,
      },
      { onConflict: "twilio_call_sid" },
    );
  if (error) throw new Error(`supabase incoming voice_call upsert failed: ${error.message}`);
}

export async function saveVoiceCall(
  conversationId: string,
  durationSeconds: number | null,
  success: boolean | null,
  payload: Record<string, unknown>,
  enrichment: SaveVoiceCallEnrichment = {},
): Promise<void> {
  const env = getEnv();
  const callerNumber = extractCallerPhone(payload) ?? "unknown";
  const normalisedCaller = callerNumber !== "unknown" ? normalisePhone(callerNumber) : null;
  const customerId = normalisedCaller
    ? await safeFindCustomerIdByPhone(normalisedCaller)
    : null;

  const payloadStatus =
    typeof payload["status"] === "string" ? payload["status"].toLowerCase() : null;
  const status =
    success === true ||
    payloadStatus === "done" ||
    payloadStatus === "completed" ||
    payloadStatus === "success"
      ? "completed"
      : success === false ||
          payloadStatus === "failed" ||
          payloadStatus === "error"
        ? "failed"
        : "in_progress";

  const row: Record<string, unknown> = {
    clinic_id:                    env.AGENT_CLINIC_ID,
    elevenlabs_conversation_id:   conversationId,
    direction:                    "inbound",
    status,
    duration_seconds:             durationSeconds,
    from_number:                  callerNumber,
    to_number:                    env.TWILIO_PHONE_NUMBER,
    agent_name:                   "tomer",
    metadata:                     payload,
  };

  if (customerId) row["customer_id"] = customerId;
  if (status === "completed" || status === "failed") row["ended_at"] = new Date().toISOString();
  if (enrichment.transcript !== undefined)            row["transcript"]              = enrichment.transcript;
  if (enrichment.aiSummary !== undefined)             row["ai_summary"]              = enrichment.aiSummary;
  if (enrichment.callCategory !== undefined) {
    const cat = enrichment.callCategory;
    row["call_category"] = cat !== null && VALID_CALL_CATEGORIES.has(cat) ? cat : null;
  }
  if (enrichment.recordingStoragePath !== undefined)  row["recording_storage_path"]  = enrichment.recordingStoragePath;

  const twilioCallSid = extractTwilioCallSid(payload);
  if (twilioCallSid) {
    const { data, error } = await getSupabase()
      .from("voice_calls")
      .update(row)
      .eq("twilio_call_sid", twilioCallSid)
      .select("id");
    if (error) throw new Error(`supabase voice_call update failed: ${error.message}`);
    if (data && data.length > 0) return;
    logger.warn(
      { twilioCallSid, conversationId },
      "voice_call: no row matched twilio_call_sid, falling back to upsert by conversation id",
    );
  }

  const { error } = await getSupabase()
    .from("voice_calls")
    .upsert(row, { onConflict: "elevenlabs_conversation_id" });
  if (error) throw new Error(`supabase voice_call upsert failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generic, non-leaking message for every failure mode of verifyPetOwnership:
// unknown phone, malformed pet_id, non-existent pet, or a pet that exists
// but belongs to a different customer/clinic. Never hint at which case it was.
const PET_NOT_FOUND_HE = "לא מצאתי חיה כזו ברשומות שלך.";

type ProblemListEntry = {
  condition: string;
  onsetDate?: string | null;
  severity?: string | null;
  notes?: string | null;
};

function extractProblemList(row: unknown): ProblemListEntry[] {
  if (row === null || typeof row !== "object") return [];
  const val = (row as Record<string, unknown>)["active_problem_list"];
  if (!Array.isArray(val)) return [];
  return val.filter(
    (item): item is ProblemListEntry =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>)["condition"] === "string",
  );
}

/**
 * Mandatory cross-check reused by every pet-scoped lookup (getPatientReminders,
 * getPatientChronicConditions, getLastVisitPlan): confirms petId is a
 * syntactically valid UUID AND actually belongs to a pet owned by the
 * customer identified by phone, within AGENT_CLINIC_ID. Returns null for
 * every failure mode (malformed UUID, unknown phone, non-existent pet, or a
 * pet belonging to a different customer/clinic) — callers must map a null
 * result to the single generic PET_NOT_FOUND_HE message and must never leak
 * which failure mode occurred (e.g. never reveal that the pet_id belongs to
 * someone else). This defends against a confused/hallucinating LLM reusing a
 * stale or wrong pet_id from an earlier turn or a different call.
 */
async function verifyPetOwnership(phone: string, petId: string): Promise<PetSummary | null> {
  if (!UUID_RE.test(petId)) return null;

  const normalised = normalisePhone(phone);
  if (!normalised) return null;
  const customerId = await findCustomerIdByPhone(normalised);
  if (!customerId) return null;

  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("pets")
    .select("id, name, species")
    .eq("id", petId)
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`verifyPetOwnership failed: ${error.message}`);
  if (!data) return null;

  const id = extractId(data);
  const name = extractString(data, "name");
  const species = extractString(data, "species");
  if (!id || !name || !species) return null;

  return { id, name, species };
}

async function findPetVisitIds(clinicId: string, petId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("visits")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("pet_id", petId)
    .is("deleted_at", null);

  if (error) throw new Error(`findPetVisitIds failed: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const id = extractId(row);
    return id ? [id] : [];
  });
}

async function findActiveAppointmentNear(
  clinicId: string,
  customerId: string,
  scheduledAt: string,
): Promise<AppointmentRow | null> {
  const target = new Date(scheduledAt);
  if (isNaN(target.getTime())) return null;

  const rangeStart = new Date(target.getTime() - 2 * 60 * 1000).toISOString();
  const rangeEnd   = new Date(target.getTime() + 2 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from("appointments")
    .select("id, customer_id, scheduled_at, appointment_type, duration_minutes, customers(full_name), pets(name)")
    .eq("clinic_id", clinicId)
    .eq("customer_id", customerId)
    .in("status", ["scheduled", "confirmed", "pending_approval", "checked_in", "in_visit"])
    .is("deleted_at", null)
    .gte("scheduled_at", rangeStart)
    .lte("scheduled_at", rangeEnd)
    .limit(1);

  if (error) throw new Error(`findActiveAppointmentNear failed: ${error.message}`);
  if (!data || data.length === 0) return null;

  const row = data[0];
  const id               = extractId(row);
  const customer_id      = extractString(row, "customer_id") ?? customerId;
  const scheduled_at     = extractString(row, "scheduled_at");
  const appointment_type = extractString(row, "appointment_type") ?? "other";
  const duration_minutes = extractNumber(row, "duration_minutes") ?? 40;
  const customer_name    = extractNestedString(row, "customers", "full_name") ?? "";
  const pet_name         = extractNestedString(row, "pets", "name") ?? "";

  if (!id || !scheduled_at) return null;
  return { id, customer_id, scheduled_at, appointment_type, duration_minutes, customer_name, pet_name };
}

async function safeFindCustomerIdByPhone(phone: string): Promise<string | null> {
  try {
    return await findCustomerIdByPhone(phone);
  } catch (err) {
    logger.warn({ err }, "voice_call: customer lookup failed");
    return null;
  }
}

async function linkVoiceCall(params: {
  twilioCallSid?: string;
  conversationId?: string;
  customerId: string;
  petId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
}): Promise<void> {
  if (!params.twilioCallSid && !params.conversationId) return;

  const patch = {
    customer_id: params.customerId,
    pet_id: params.petId ?? null,
    appointment_id: params.appointmentId ?? null,
    visit_id: params.visitId ?? null,
  };

  if (params.twilioCallSid) {
    const { data, error } = await getSupabase()
      .from("voice_calls")
      .update(patch)
      .eq("twilio_call_sid", params.twilioCallSid)
      .select("id");
    if (error) throw new Error(`linkVoiceCall by twilio sid failed: ${error.message}`);
    if (data && data.length > 0) return;
  }

  if (params.conversationId) {
    const { error } = await getSupabase()
      .from("voice_calls")
      .update(patch)
      .eq("elevenlabs_conversation_id", params.conversationId);
    if (error) throw new Error(`linkVoiceCall by conversation id failed: ${error.message}`);
  }
}

/**
 * Raised when the number belongs to a customer Dana deactivated. Reactivating
 * someone from a phone call is a decision for the clinic, not for Tomer, so
 * the callers turn this into a spoken answer rather than booking.
 */
export class InactiveCustomerError extends Error {
  constructor() {
    super("customer exists but is not active");
    this.name = "InactiveCustomerError";
  }
}

/** Ignores `status` — used only to tell "no such customer" from "deactivated". */
async function findAnyCustomerIdByPhone(phone: string): Promise<string | null> {
  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("customers")
    .select("id")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`findAnyCustomerIdByPhone failed: ${error.message}`);
  return extractId(data);
}

async function createOrFindCustomer(
  phone: string,
  name: string,
): Promise<{ customerId: string }> {
  // Every caller already rejects an unusable number, but this is the function
  // that actually inserts the row — and the one that created the phone = "+"
  // customer that then absorbed every later junk call, because the find-step
  // below matched it. Refuse here too rather than trust the callers.
  if (!normaliseIsraeliPhone(phone)) {
    throw new Error(`createOrFindCustomer: refusing to store unusable phone ${JSON.stringify(phone)}`);
  }
  const existingId = await findCustomerIdByPhone(phone);
  if (existingId) return { customerId: existingId };

  const env = getEnv();
  const { data: inserted, error } = await getSupabase()
    .from("customers")
    .insert({ clinic_id: env.AGENT_CLINIC_ID, full_name: name, phone, status: "active" })
    .select("id")
    .single();

  if (error) {
    // Two near-simultaneous calls for the same new phone number can both
    // pass the find-step above before either inserts; customers_clinic_phone_unique_idx
    // then rejects the loser here. Re-fetch instead of surfacing a spurious
    // "internal error" — the winner's row already has what the caller needs.
    if (error.code === "23505") {
      const raceId = await findCustomerIdByPhone(phone);
      if (raceId) return { customerId: raceId };
      // Not a race: customers_clinic_phone_unique_idx is held by a row the
      // find-step skipped, which (given the deleted_at filter matches) means
      // an inactive customer. Since findCustomerIdByPhone started filtering on
      // status, this is the path a deactivated client's call now takes.
      if (await findAnyCustomerIdByPhone(phone)) throw new InactiveCustomerError();
    }
    throw new Error(`createOrFindCustomer failed: ${error.message}`);
  }
  const id = extractId(inserted);
  if (!id) throw new Error("createOrFindCustomer: no id returned");
  return { customerId: id };
}

async function findPetIdByName(
  customerId: string,
  petName: string,
): Promise<string | null> {
  const env = getEnv();
  const { data, error } = await getSupabase()
    .from("pets")
    .select("id")
    .eq("clinic_id", env.AGENT_CLINIC_ID)
    .eq("customer_id", customerId)
    .ilike("name", petName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`findPetIdByName failed: ${error.message}`);
  return extractId(data);
}

async function createOrFindPet(
  customerId: string,
  petName: string,
  species: string,
  breed?: string | null,
): Promise<{ petId: string }> {
  const env = getEnv();

  const existingId = await findPetIdByName(customerId, petName);
  if (existingId) return { petId: existingId };

  const { data: inserted, error: insertErr } = await getSupabase()
    .from("pets")
    .insert({
      clinic_id:   env.AGENT_CLINIC_ID,
      customer_id: customerId,
      name:        petName,
      species,
      breed:       breed?.trim() ? breed.trim() : null,
      status:      "active",
    })
    .select("id")
    .single();

  if (insertErr) {
    // Same race as createOrFindCustomer above, guarded here by
    // pets_clinic_customer_name_unique_idx.
    if (insertErr.code === "23505") {
      const raceId = await findPetIdByName(customerId, petName);
      if (raceId) return { petId: raceId };
    }
    throw new Error(`createOrFindPet insert failed: ${insertErr.message}`);
  }
  const id = extractId(inserted);
  if (!id) throw new Error("createOrFindPet: no id returned");
  return { petId: id };
}
