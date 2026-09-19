-- Sprint 2: SMS notification pipeline
-- Creates notifications_log, adds changed_via to appointments,
-- enables pg_net, registers pg_cron job, and sets up a DB trigger
-- for dashboard-initiated appointment changes.

-- ─────────────────────────────────────────────────────────────
-- 1. appointments: changed_via column
--    'agent'     = Tomer (voice agent) — no DB trigger SMS
--    'dashboard' = Dana via dashboard   — DB trigger sends SMS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS changed_via text
  CHECK (changed_via IN ('agent', 'dashboard'));

-- ─────────────────────────────────────────────────────────────
-- 2. notifications_log
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.notifications_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  customer_id         uuid        NOT NULL,
  appointment_id      uuid        REFERENCES public.appointments (id) ON DELETE SET NULL,
  phone               text        NOT NULL,
  type                text        NOT NULL
                                  CHECK (type IN (
                                    'booking_confirmation',
                                    'morning_reminder',
                                    'post_visit_followup',
                                    'reschedule_update',
                                    'cancellation_update',
                                    'client_cancellation_confirmation'
                                  )),
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  scheduled_for       timestamptz NOT NULL,
  sent_at             timestamptz,
  body                text        NOT NULL,
  twilio_message_sid  text,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- idempotency: one row per (appointment, type)
  CONSTRAINT notifications_log_appt_type_unique UNIQUE (appointment_id, type)
);

CREATE TRIGGER notifications_log_set_updated_at
  BEFORE UPDATE ON public.notifications_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fast lookup for the cron processor
CREATE INDEX notifications_log_pending_scheduled_idx
  ON public.notifications_log (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX notifications_log_appointment_idx
  ON public.notifications_log (appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_log_select_member ON public.notifications_log
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));
-- Agent and DB trigger write via service_role (bypasses RLS).

-- ─────────────────────────────────────────────────────────────
-- 3. pg_net extension (for pg_cron HTTP calls)
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────
-- 4. pg_cron job: call /jobs/process-notifications every 15 min
--    IMPORTANT: replace AGENT_PUBLIC_URL and JOBS_BEARER_TOKEN
--    after Vercel deploy using:
--      SELECT cron.unschedule('process-sms-notifications');
--      SELECT cron.schedule(...) with real values.
-- ─────────────────────────────────────────────────────────────

-- pg_cron job: activate AFTER Vercel deploy with real URL + JOBS_BEARER_TOKEN.
-- Run manually in Supabase SQL editor once deployed:
--
--   SELECT cron.schedule(
--     'process-sms-notifications',
--     '*/15 * * * *',
--     $$
--     SELECT extensions.http_post(
--       url     := 'https://<AGENT_PUBLIC_URL>/jobs/process-notifications',
--       headers := jsonb_build_object('Authorization', 'Bearer <JOBS_BEARER_TOKEN>', 'Content-Type', 'application/json'),
--       body    := '{}'
--     );
--     $$
--   );
--
-- See CLAUDE.md § "הפעלת cron" for instructions.

-- ─────────────────────────────────────────────────────────────
-- 5. DB trigger: send SMS when Dana changes appointments
--    Fires only when changed_via = 'dashboard'.
--    On cancellation: skips pending notifications + enqueues cancellation_update.
--    On reschedule (same appt, new scheduled_at): updates scheduled_for of
--      morning_reminder and post_visit_followup, patches the time in body,
--      enqueues reschedule_update.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.appointments_notify_dashboard_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name text;
  v_pet_name      text;
  v_phone         text;
  v_new_morning   timestamptz;
  v_new_followup  timestamptz;
BEGIN
  -- Only fire for dashboard-sourced changes
  IF NEW.changed_via IS DISTINCT FROM 'dashboard' THEN
    RETURN NEW;
  END IF;

  -- Fetch customer and pet info
  SELECT c.full_name, c.phone
    INTO v_customer_name, v_phone
    FROM public.customers c
   WHERE c.id = NEW.customer_id AND c.clinic_id = NEW.clinic_id;

  SELECT p.name
    INTO v_pet_name
    FROM public.pets p
   WHERE p.id = NEW.pet_id AND p.clinic_id = NEW.clinic_id;

  -- ── Cancellation ────────────────────────────────────────────
  IF NEW.status IN ('cancelled', 'late_cancellation')
     AND OLD.status NOT IN ('cancelled', 'late_cancellation', 'completed') THEN

    -- Skip all pending future notifications for this appointment
    UPDATE public.notifications_log
       SET status = 'skipped', updated_at = now()
     WHERE appointment_id = NEW.id AND status = 'pending';

    -- Enqueue cancellation_update immediately (ON CONFLICT: re-trigger if needed)
    INSERT INTO public.notifications_log
      (clinic_id, customer_id, appointment_id, phone, type, status, scheduled_for, body)
    VALUES (
      NEW.clinic_id,
      NEW.customer_id,
      NEW.id,
      v_phone,
      'cancellation_update',
      'pending',
      now(),
      format(
        E'שלום %s, עדכון מ-Demo Vet Clinic:\nבשל אילוץ רפואי, התור של %s מיום %s בוטל.\nנשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\nמתנצלים על אי הנוחות 🙏 תומר, Demo Vet Clinic',
        v_customer_name,
        v_pet_name,
        to_char(OLD.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'DD.MM.YYYY')
      )
    )
    ON CONFLICT (appointment_id, type) DO UPDATE
      SET scheduled_for = now(),
          body          = EXCLUDED.body,
          status        = 'pending',
          sent_at       = NULL,
          twilio_message_sid = NULL,
          error         = NULL,
          updated_at    = now();

    RETURN NEW;
  END IF;

  -- ── Reschedule (same appointment, new scheduled_at) ─────────
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.status IN ('scheduled', 'confirmed', 'pending_approval') THEN

    -- 08:00 Jerusalem on the appointment day, expressed as UTC (DST-correct).
    -- Step 1: convert scheduled_at to Jerusalem local timestamp (no TZ info).
    -- Step 2: truncate to day → midnight Jerusalem local.
    -- Step 3: add 8 hours → 08:00 Jerusalem local.
    -- Step 4: convert back to UTC via AT TIME ZONE → timestamptz.
    v_new_morning := (
      date_trunc('day', NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem')
      + interval '8 hours'
    ) AT TIME ZONE 'Asia/Jerusalem';

    v_new_followup := NEW.scheduled_at
                       + make_interval(mins => NEW.duration_minutes)
                       + interval '24 hours';

    -- Update morning_reminder: new scheduled_for + patch time in body
    UPDATE public.notifications_log
       SET scheduled_for = v_new_morning,
           body          = regexp_replace(
                             body,
                             '🕒 \d{2}:\d{2}',
                             '🕒 ' || to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
                           ),
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'morning_reminder'
       AND status = 'pending';

    -- Update post_visit_followup: new scheduled_for only
    UPDATE public.notifications_log
       SET scheduled_for = v_new_followup,
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'post_visit_followup'
       AND status = 'pending';

    -- Enqueue reschedule_update immediately (re-trigger on repeat reschedules)
    INSERT INTO public.notifications_log
      (clinic_id, customer_id, appointment_id, phone, type, status, scheduled_for, body)
    VALUES (
      NEW.clinic_id,
      NEW.customer_id,
      NEW.id,
      v_phone,
      'reschedule_update',
      'pending',
      now(),
      format(
        E'שלום %s, עדכון מ-Demo Vet Clinic:\nבשל אילוץ רפואי, התור של %s מיום %s עודכן:\n📅 מועד חדש: %s | 🕒 %s | 📍 הקליניקה, הדוגמה 1 ת"א\nהמועד לא מתאים? חייגו אלינו ונמצא זמן אחר.\nמתנצלים על אי הנוחות 🙏 תומר, Demo Vet Clinic',
        v_customer_name,
        v_pet_name,
        to_char(OLD.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'DD.MM.YYYY'),
        to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'DD.MM.YYYY'),
        to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
      )
    )
    ON CONFLICT (appointment_id, type) DO UPDATE
      SET scheduled_for = now(),
          body          = EXCLUDED.body,
          status        = 'pending',
          sent_at       = NULL,
          twilio_message_sid = NULL,
          error         = NULL,
          updated_at    = now();

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_notify_dashboard_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_notify_dashboard_change();
