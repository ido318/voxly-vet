import { Hono } from "hono";
import { z } from "zod";
import { logger, maskPhone } from "../../lib/logger.js";
import { getEnv } from "../../lib/env.js";
import { isValidBearerToken } from "../middleware/bearerAuth.js";
import { israelDateIso, isValidIsraeliPhone } from "@tomer/shared";
import {
  findCustomerByPhone,
  addEscalation,
  checkAvailability,
  getFreeSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  joinWaitlist,
  listCustomerPets,
  listCustomerAppointments,
  getPatientReminders,
  getPatientChronicConditions,
  getLastVisitPlan,
} from "../../lib/store.js";
import { VISIT_TYPE_VALUES, formatSlotSpokenHe } from "../../lib/appointments.js";
import {
  decideTriage,
  EMERGENCY_SCRIPT,
  URGENT_CALLBACK_SCRIPT,
  AFTER_HOURS_SCRIPT,
  ROUTINE_SCRIPT,
} from "../../services/triage.service.js";
import {
  decideConversationPolicy,
  formatConversationPolicyForVoice,
} from "../../services/conversation-policy.service.js";
import { decideHumanHandoff } from "../../services/handoff.service.js";

export const toolsRoutes = new Hono();

// All /tools/* routes require a Bearer token sent by ElevenLabs as a static request header.
// ElevenLabs ConvAI tool calls do not use HMAC signing — they use a pre-shared Bearer token
// configured in each tool's api_schema.request_headers (set by sync-elevenlabs-agent.ts).
toolsRoutes.use("/tools/*", async (c, next) => {
  const env = getEnv();
  if (!isValidBearerToken(c.req.header("authorization"), env.TOOLS_BEARER_TOKEN)) {
    logger.warn({ path: c.req.path }, "tools: unauthorized");
    return c.json({ error: "forbidden" }, 403);
  }

  return next();
});

// Shared visit type enum — mirrors public.appointment_type (Sprint 1 values)
const PET_SPECIES_VALUES = ["כלב", "חתול", "אחר"] as const;

// ISO8601 datetime — requires timezone (Z or ±HH:MM) to avoid ambiguous local times
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/conversation-policy
// ─────────────────────────────────────────────────────────────────────────────

const conversationPolicySchema = z.object({
  user_utterance_he: z.string().min(1),
  known_pet_type: z.enum(PET_SPECIES_VALUES).optional(),
  known_symptoms_he: z.string().optional(),
  known_duration_he: z.string().optional(),
  red_flag_answers_he: z.array(z.string()).optional(),
  last_agent_action: z.string().optional(),
  repeated_turns: z.number().int().min(0).optional(),
});

toolsRoutes.post("/tools/conversation-policy", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = conversationPolicySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר חסר: user_utterance_he." });
  }

  const policy = decideConversationPolicy(parsed.data);
  return c.json({ result: formatConversationPolicyForVoice(policy) });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/lookup-customer
// ─────────────────────────────────────────────────────────────────────────────

// Every phone parameter below used to be `z.string().min(5)`, which accepted
// "aaaaa", "-----" and "unknown". normalisePhone then turned those into the
// string "+" and stored them as a customer's phone number. A failed safeParse
// already returns a Hebrew {result}, so tightening the schema is all it takes
// for Tomer to ask for the number again instead of writing an unreachable one.
//
// Validates the raw input; normalisation to E.164 still happens in store.ts.
const israeliPhone = z
  .string()
  .refine(isValidIsraeliPhone, { message: "not a valid Israeli phone number" });

const lookupSchema = z.object({ phone: israeliPhone });

toolsRoutes.post("/tools/lookup-customer", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר phone חסר או שגוי." });
  }

  logger.info({ phone: maskPhone(parsed.data.phone) }, "tool: lookup-customer");

  // Same try/catch shape as book/cancel. Without it a Supabase error escaped
  // as a raw 500 with no {result}, which the model cannot say out loud — the
  // caller heard silence instead of "אסוף פרטים בעצמך".
  try {
    const customer = await findCustomerByPhone(parsed.data.phone);

    if (!customer) {
      return c.json({ result: "לקוח לא מוכר. אסוף פרטים בעצמך." });
    }

    const petList = customer.pets
      .map((p) => [p.name, p.species, p.breed].filter(Boolean).join(" - "))
      .join(", ");
    return c.json({
      result: `שם: ${customer.full_name}, חיות: ${petList}`,
      customer_id: customer.id,
      pets: customer.pets.map((p) => ({ id: p.id, name: p.name, species: p.species })),
    });
  } catch (err) {
    logger.error({ err }, "tool: lookup-customer — internal error");
    // Degrade to the unknown-customer script rather than to silence: Tomer can
    // still take the details by hand.
    return c.json({ result: "לקוח לא מוכר. אסוף פרטים בעצמך." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/escalate-to-vet
// ─────────────────────────────────────────────────────────────────────────────

// phone is `required` in the ElevenLabs tool definition so the model always
// sends {{system__caller_id}}, but optional here on purpose: a withheld caller
// id must not cost us the escalation. An escalation Dana never sees is worse
// than one without a number.
const escalateSchema = z.object({
  reason: z.string().min(1),
  urgency: z.number().int().min(1).max(10),
  phone: israeliPhone.optional(),
});

toolsRoutes.post("/tools/escalate-to-vet", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = escalateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: reason, urgency (1-10)." });
  }

  const { reason, urgency, phone } = parsed.data;

  if (urgency >= 7) {
    logger.warn({ urgency, reason }, "tool: escalate-to-vet — HIGH URGENCY");
  } else {
    logger.info({ urgency, reason }, "tool: escalate-to-vet");
  }

  try {
    await addEscalation({
      reason,
      urgency,
      caller_phone: phone ?? null,
    });
  } catch (err) {
    logger.error({ err, urgency }, "tool: escalate-to-vet — write failed");
    // Never claim it reached Dana when it did not; tell the caller to phone in.
    return c.json({
      result: "לא הצלחתי לרשום את הפנייה. אנא התקשרו שוב מאוחר יותר או פנו ישירות למרפאה.",
    });
  }

  return c.json({ result: `הועברה לדנה (urgency: ${urgency}/10)` });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/request-human-handoff
// Transfers the live call to Dana's mobile during business hours; otherwise
// records an escalation. The actual PSTN transfer is executed by ElevenLabs
// using the returned `number` when `transfer` is true.
// ─────────────────────────────────────────────────────────────────────────────

const handoffSchema = z.object({
  reason: z.string().min(1).optional(),
  emergency: z.boolean().optional(),
  phone: israeliPhone.optional(),
  conversation_id: z.string().min(1).optional(),
});

toolsRoutes.post("/tools/request-human-handoff", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = handoffSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : undefined;
  const emergency = parsed.success ? parsed.data.emergency : undefined;

  const decision = decideHumanHandoff({
    now: new Date(),
    targetNumber: getEnv().HUMAN_HANDOFF_NUMBER,
    emergency,
  });

  if (decision.escalate) {
    // These used to be written with no phone, no customer and no call id, so
    // the dashboard showed a request to speak to a human with no way to reach
    // whoever asked.
    await addEscalation({
      reason: reason ?? "בקשת מעבר לנציג אנושי",
      urgency: decision.urgency ?? 6,
      caller_phone: parsed.success ? parsed.data.phone ?? null : null,
      conversation_id: parsed.success ? parsed.data.conversation_id ?? null : null,
      context: { source: "request-human-handoff", emergency: emergency ?? false },
    });
  }

  logger.info(
    { transfer: decision.transfer, escalate: decision.escalate },
    "tool: request-human-handoff",
  );

  return c.json({
    result: decision.result,
    transfer: decision.transfer,
    ...(decision.number ? { number: decision.number } : {}),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/triage-pet-case
// ─────────────────────────────────────────────────────────────────────────────

const triageSchema = z.object({
  symptoms_he:        z.string().min(1),
  duration_he:        z.string().optional(),
  pet_type:           z.enum(PET_SPECIES_VALUES),
  pet_age_years:      z.number().positive().optional(),
  pet_weight_kg:      z.number().positive().optional(),
  additional_signs_he: z.array(z.string()).optional(),
  phone:              israeliPhone.optional(),
  customer_id:        z.string().uuid().optional(),
  pet_id:             z.string().uuid().optional(),
});

toolsRoutes.post("/tools/triage-pet-case", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, "tool: triage-pet-case — validation failed");
    return c.json({ result: "פרמטרים חסרים: symptoms_he, pet_type." });
  }

  const input = parsed.data;
  const now = new Date();

  // Combine symptoms + duration hint for richer text matching
  const fullText = [
    input.symptoms_he,
    input.duration_he ?? "",
    ...(input.additional_signs_he ?? []),
  ].join(" ");

  const triage = decideTriage({ text: fullText, now });

  logger.info(
    {
      decision: triage.decision,
      urgency: triage.urgency,
      flags: triage.matchedFlags,
      within_hours: triage.withinBusinessHours,
    },
    "tool: triage-pet-case",
  );

  // ── Escalation (fire-and-forget) ──────────────────────────────────────────
  const shouldEscalate =
    triage.decision !== "routine" || triage.matchedFlags.length > 0;

  if (shouldEscalate) {
    const escalationUrgency =
      triage.decision === "urgent_callback"
        ? Math.max(4, triage.urgency)
        : triage.decision === "after_hours_referral"
          ? Math.min(triage.urgency, 5)  // low priority — info for morning
          : triage.urgency;

    void addEscalation({
      // reason stays a one-line summary for the card heading. The caller's own
      // words used to be truncated to 120 characters inside it; they now go to
      // context.symptoms_he in full, because that is what Dana reads before
      // calling back.
      reason: `triage: ${triage.decision} — flags: ${triage.matchedFlags.join(", ") || "none"}`,
      urgency: escalationUrgency,
      caller_phone: input.phone ?? null,
      customer_id: input.customer_id ?? null,
      pet_id: input.pet_id ?? null,
      context: {
        decision: triage.decision,
        after_hours: !triage.withinBusinessHours,
        matched_flags: triage.matchedFlags,
        symptoms_he: input.symptoms_he,
        duration_he: input.duration_he ?? null,
        pet_type: input.pet_type,
      },
    }).catch((err: unknown) =>
      logger.error({ err }, "triage-pet-case: escalation write failed"),
    );
  }

  // ── Build script ──────────────────────────────────────────────────────────
  let script: string;

  switch (triage.decision) {
    case "emergency_referral":
      script = EMERGENCY_SCRIPT;
      break;

    case "urgent_callback": {
      // Try to find a phone_consultation slot today.
      //
      // This used to regex a time out of checkAvailability's Hebrew prose,
      // which is written for the LLM, not for parsing. formatSlotSpokenHe
      // renders a 12-hour hour with no leading zero ("1:00 בצהריים"), so
      // \b(\d{2}:\d{2})\b skipped the spoken time and matched the seconds
      // inside the ISO that follows it — 13:00 was announced as "00:00". On a
      // Saturday it matched 08:00 out of the opening hours quoted in the
      // "clinic is closed" message and offered a slot on a closed day.
      //
      // getFreeSlots returns the instants themselves, so there is nothing to
      // parse and a closed day simply yields none.
      let slotSuffix = "";
      try {
        const todayIso = israelDateIso(now);
        const [firstSlot] = await getFreeSlots(todayIso, "phone_consultation");
        if (firstSlot) {
          slotSuffix = ` מצאתי אפשרות לשיחה עם ד"ר דנה היום ב-${formatSlotSpokenHe(firstSlot)} — לקבוע?`;
        }
      } catch {
        // slot lookup is best-effort; don't fail the triage call
      }
      script = URGENT_CALLBACK_SCRIPT + slotSuffix;
      break;
    }

    case "after_hours_referral":
      script = AFTER_HOURS_SCRIPT;
      break;

    default:
      script = ROUTINE_SCRIPT;
  }

  return c.json({ result: script });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/check-availability
// ─────────────────────────────────────────────────────────────────────────────

const availabilitySchema = z.object({
  date_iso:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  visit_type: z.enum(VISIT_TYPE_VALUES),
});

toolsRoutes.post("/tools/check-availability", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = availabilitySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "נדרש תאריך בפורמט YYYY-MM-DD וסוג ביקור (visit_type)." });
  }

  try {
    logger.info({ date: parsed.data.date_iso, visit_type: parsed.data.visit_type }, "tool: check-availability");
    const result = await checkAvailability(parsed.data.date_iso, parsed.data.visit_type);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: check-availability — internal error");
    return c.json({ result: "שגיאה פנימית בבדיקת זמינות. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/book-appointment
// ─────────────────────────────────────────────────────────────────────────────

const bookSchema = z.object({
  phone:         israeliPhone,
  customer_name: z.string().min(1),
  pet_name:      z.string().min(1),
  pet_species:   z.enum(PET_SPECIES_VALUES),
  pet_breed:     z.string().min(1).optional().nullable(),
  scheduled_at:  z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime"),
  visit_type:    z.enum(VISIT_TYPE_VALUES),
  reason:        z.string().optional(),
  twilio_call_sid: z.string().min(1).optional(),
  elevenlabs_conversation_id: z.string().min(1).optional(),
});

toolsRoutes.post("/tools/book-appointment", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      result: "פרמטרים חסרים: phone, customer_name, pet_name, pet_species, scheduled_at (ISO8601), visit_type.",
    });
  }

  try {
    logger.info({ phone: maskPhone(parsed.data.phone), visit_type: parsed.data.visit_type }, "tool: book-appointment");
    const result = await bookAppointment(parsed.data);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: book-appointment — internal error");
    return c.json({ result: "שגיאה פנימית בקביעת תור. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/cancel-or-reschedule
// ─────────────────────────────────────────────────────────────────────────────

const cancelRescheduleSchema = z.object({
  phone:                israeliPhone,
  action:               z.enum(["cancel", "reschedule"]),
  current_scheduled_at: z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime"),
  new_scheduled_at:     z.string().regex(ISO_DATETIME_RE, "Expected ISO8601 datetime").optional(),
  visit_type:           z.enum(VISIT_TYPE_VALUES).optional(),
});

toolsRoutes.post("/tools/cancel-or-reschedule", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelRescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: phone, action, current_scheduled_at (ISO8601)." });
  }

  const { phone, action, current_scheduled_at, new_scheduled_at, visit_type } = parsed.data;
  logger.info({ phone: maskPhone(phone), action }, "tool: cancel-or-reschedule");

  try {
    if (action === "cancel") {
      const result = await cancelAppointment(phone, current_scheduled_at);
      return c.json({ result });
    }

    if (!new_scheduled_at) {
      return c.json({ result: "לביצוע הזזה נדרש גם new_scheduled_at." });
    }

    const result = await rescheduleAppointment(phone, current_scheduled_at, new_scheduled_at, visit_type);
    return c.json({ result });
  } catch (err) {
    logger.error({ err, action }, "tool: cancel-or-reschedule — internal error");
    return c.json({ result: "שגיאה פנימית. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/join-waitlist
// ─────────────────────────────────────────────────────────────────────────────

const waitlistSchema = z.object({
  phone:           israeliPhone,
  customer_name:   z.string().min(1),
  pet_name:        z.string().min(1),
  pet_species:     z.enum(PET_SPECIES_VALUES),
  pet_breed:       z.string().min(1).optional().nullable(),
  visit_type:      z.enum(VISIT_TYPE_VALUES),
  preferred_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:           z.string().optional(),
});

toolsRoutes.post("/tools/join-waitlist", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      result: "פרמטרים חסרים: phone, customer_name, pet_name, pet_species, visit_type.",
    });
  }

  try {
    logger.info({ phone: maskPhone(parsed.data.phone), visit_type: parsed.data.visit_type }, "tool: join-waitlist");
    const result = await joinWaitlist(parsed.data);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: join-waitlist — internal error");
    return c.json({ result: "שגיאה פנימית ברישום לרשימת ההמתנה. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/list-customer-appointments
// ─────────────────────────────────────────────────────────────────────────────

const listCustomerAppointmentsSchema = z.object({ phone: israeliPhone });

toolsRoutes.post("/tools/list-customer-appointments", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = listCustomerAppointmentsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר phone חסר או שגוי." });
  }

  logger.info({ phone: maskPhone(parsed.data.phone) }, "tool: list-customer-appointments");

  try {
    const { result, appointments } = await listCustomerAppointments(parsed.data.phone);
    return c.json({ result, appointments });
  } catch (err) {
    logger.error({ err }, "tool: list-customer-appointments — internal error");
    return c.json({ result: "שגיאה פנימית באחזור התורים. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/list-customer-pets
// ─────────────────────────────────────────────────────────────────────────────

const listCustomerPetsSchema = z.object({ phone: israeliPhone });

toolsRoutes.post("/tools/list-customer-pets", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = listCustomerPetsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטר phone חסר או שגוי." });
  }

  logger.info({ phone: maskPhone(parsed.data.phone) }, "tool: list-customer-pets");

  try {
    const { result, pets } = await listCustomerPets(parsed.data.phone);
    // `pets` is extra structured data alongside `result` (mirrors
    // /tools/request-human-handoff's transfer/number fields above) — ElevenLabs
    // passes the full tool JSON to the model, so it can reference pet_id even
    // though this array itself is never spoken aloud.
    return c.json({ result, pets });
  } catch (err) {
    logger.error({ err }, "tool: list-customer-pets — internal error");
    return c.json({ result: "שגיאה פנימית באחזור רשימת החיות. נסה שוב." }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /tools/get-patient-reminders
// POST /tools/get-patient-chronic-conditions
// POST /tools/get-last-visit-plan
//
// All three share the same request shape: {phone, pet_id}. Ownership of
// pet_id by the phone's customer (and rejection of a malformed pet_id) is
// enforced inside store.ts's shared verifyPetOwnership helper, not here.
// ─────────────────────────────────────────────────────────────────────────────

const petLookupSchema = z.object({
  phone: israeliPhone,
  pet_id: z.string().min(1),
});

toolsRoutes.post("/tools/get-patient-reminders", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = petLookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: phone, pet_id." });
  }

  logger.info(
    { phone: maskPhone(parsed.data.phone), pet_id: parsed.data.pet_id },
    "tool: get-patient-reminders",
  );

  try {
    const result = await getPatientReminders(parsed.data.phone, parsed.data.pet_id);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: get-patient-reminders — internal error");
    return c.json({ result: "שגיאה פנימית באחזור תזכורות חיסון. נסה שוב." }, 500);
  }
});

toolsRoutes.post("/tools/get-patient-chronic-conditions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = petLookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: phone, pet_id." });
  }

  logger.info(
    { phone: maskPhone(parsed.data.phone), pet_id: parsed.data.pet_id },
    "tool: get-patient-chronic-conditions",
  );

  try {
    const result = await getPatientChronicConditions(parsed.data.phone, parsed.data.pet_id);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: get-patient-chronic-conditions — internal error");
    return c.json({ result: "שגיאה פנימית באחזור מצבים כרוניים. נסה שוב." }, 500);
  }
});

toolsRoutes.post("/tools/get-last-visit-plan", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = petLookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ result: "פרמטרים חסרים: phone, pet_id." });
  }

  logger.info(
    { phone: maskPhone(parsed.data.phone), pet_id: parsed.data.pet_id },
    "tool: get-last-visit-plan",
  );

  try {
    const result = await getLastVisitPlan(parsed.data.phone, parsed.data.pet_id);
    return c.json({ result });
  } catch (err) {
    logger.error({ err }, "tool: get-last-visit-plan — internal error");
    return c.json({ result: "שגיאה פנימית באחזור תוכנית הטיפול. נסה שוב." }, 500);
  }
});
