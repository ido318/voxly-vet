-- Sprint 1: appointment engine
-- Adds visit types (home_visit, phone_consultation, neutering),
-- new statuses (pending_approval, late_cancellation),
-- calendar_blocks, waitlist, and removes the fixed 30-min constraint.

-- ─────────────────────────────────────────────────────────────
-- 1. New enum values
-- ─────────────────────────────────────────────────────────────

ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'late_cancellation';

ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'home_visit';
ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'phone_consultation';
ALTER TYPE public.appointment_type ADD VALUE IF NOT EXISTS 'neutering';

-- ─────────────────────────────────────────────────────────────
-- 2. appointments: remove fixed-30-min constraint
-- ─────────────────────────────────────────────────────────────

-- The old check constrained duration_minutes = 30.
-- We now store effective_duration = visit_duration + buffer so the
-- GIST constraint automatically enforces inter-appointment gaps.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_duration_minutes_check;

-- ─────────────────────────────────────────────────────────────
-- 3. calendar_blocks — Dana blocks holidays / unavailable periods
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.calendar_blocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  reason      text,
  created_by  uuid        REFERENCES auth.users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_blocks_valid_range CHECK (end_at > start_at)
);

CREATE INDEX calendar_blocks_clinic_range_idx
  ON public.calendar_blocks (clinic_id, start_at, end_at);

ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Clinic members can see blocks (Tomer reads them at query time)
CREATE POLICY calendar_blocks_select_member ON public.calendar_blocks
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- Only admins/owners can create/update/delete blocks from the dashboard
CREATE POLICY calendar_blocks_insert_admin ON public.calendar_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY calendar_blocks_update_admin ON public.calendar_blocks
  FOR UPDATE TO authenticated
  USING  (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY calendar_blocks_delete_admin ON public.calendar_blocks
  FOR DELETE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

-- ─────────────────────────────────────────────────────────────
-- 4. waitlist
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.waitlist (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  customer_id     uuid        NOT NULL,
  pet_id          uuid        NOT NULL,
  visit_type      public.appointment_type NOT NULL,
  preferred_start date,
  preferred_end   date,
  status          text        NOT NULL DEFAULT 'waiting'
                              CHECK (status IN ('waiting', 'scheduled', 'expired', 'cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_customer_clinic_fk
    FOREIGN KEY (customer_id, clinic_id)
    REFERENCES public.customers (id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT waitlist_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id) ON DELETE CASCADE
);

CREATE TRIGGER waitlist_set_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX waitlist_clinic_status_idx
  ON public.waitlist (clinic_id, status, created_at);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_select_member ON public.waitlist
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- Agent writes via service_role (bypasses RLS); dashboard admins can update status
CREATE POLICY waitlist_update_admin ON public.waitlist
  FOR UPDATE TO authenticated
  USING  (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

-- ─────────────────────────────────────────────────────────────
-- 5. Update reschedule_appointment RPC — drop and recreate
--    Now accepts p_duration_minutes (variable by visit type)
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.reschedule_appointment(uuid, uuid, timestamptz, int);

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_clinic_id           uuid,
  p_old_appointment_id  uuid,
  p_new_scheduled_at    timestamptz,
  p_duration_minutes    int DEFAULT 40  -- effective = visit + buffer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid;
  v_old    public.appointments%rowtype;
BEGIN
  SELECT * INTO v_old
    FROM public.appointments
   WHERE id = p_old_appointment_id
     AND clinic_id = p_clinic_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found: %', p_old_appointment_id;
  END IF;

  IF v_old.status NOT IN ('scheduled', 'confirmed', 'pending_approval') THEN
    RAISE EXCEPTION 'appointment_not_active: status is %', v_old.status;
  END IF;

  INSERT INTO public.appointments (
    clinic_id, customer_id, pet_id, appointment_type,
    status, source, scheduled_at, end_at, duration_minutes,
    reason, created_by_user_id
  ) VALUES (
    p_clinic_id,
    v_old.customer_id,
    v_old.pet_id,
    v_old.appointment_type,
    CASE WHEN v_old.status = 'pending_approval'
         THEN 'pending_approval'::public.appointment_status
         ELSE 'scheduled'::public.appointment_status
    END,
    'phone',
    p_new_scheduled_at,
    p_new_scheduled_at + make_interval(mins => p_duration_minutes),
    p_duration_minutes,
    v_old.reason,
    NULL
  )
  RETURNING id INTO v_new_id;

  UPDATE public.appointments
     SET status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = 'rescheduled'
   WHERE id = p_old_appointment_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reschedule_appointment(uuid, uuid, timestamptz, int) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reschedule_appointment(uuid, uuid, timestamptz, int) TO service_role;
