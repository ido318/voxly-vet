-- Phase 1: database core alignment.
-- Additive-only alignment with NOA_VET_SYSTEM_SPEC.md and
-- docs/architecture/pims-foundation-alignment.md.

-- Longitudinal medical record per pet. This complements medical_notes and does
-- not replace existing visits or notes.
CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL,
  summary text,
  active_problem_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (id, clinic_id),
  CONSTRAINT medical_records_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id)
    ON DELETE RESTRICT,
  CONSTRAINT medical_records_active_problem_list_is_array
    CHECK (jsonb_typeof(active_problem_list) = 'array'),
  CONSTRAINT medical_records_alerts_is_array
    CHECK (jsonb_typeof(alerts) = 'array')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'medical_records_set_updated_at'
      AND tgrelid = 'public.medical_records'::regclass
  ) THEN
    CREATE TRIGGER medical_records_set_updated_at
      BEFORE UPDATE ON public.medical_records
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS medical_records_clinic_pet_active_unique_idx
  ON public.medical_records (clinic_id, pet_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS medical_records_clinic_pet_idx
  ON public.medical_records (clinic_id, pet_id);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_records'
      AND policyname = 'medical_records_select_member'
  ) THEN
    CREATE POLICY medical_records_select_member ON public.medical_records
      FOR SELECT TO authenticated
      USING (public.is_clinic_member(clinic_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_records'
      AND policyname = 'medical_records_insert_member'
  ) THEN
    CREATE POLICY medical_records_insert_member ON public.medical_records
      FOR INSERT TO authenticated
      WITH CHECK (public.is_clinic_member(clinic_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_records'
      AND policyname = 'medical_records_update_member'
  ) THEN
    CREATE POLICY medical_records_update_member ON public.medical_records
      FOR UPDATE TO authenticated
      USING (public.is_clinic_member(clinic_id))
      WITH CHECK (public.is_clinic_member(clinic_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_records'
      AND policyname = 'medical_records_delete_member'
  ) THEN
    CREATE POLICY medical_records_delete_member ON public.medical_records
      FOR DELETE TO authenticated
      USING (public.is_clinic_member(clinic_id));
  END IF;
END;
$$;

-- Backfill one active medical record for every active pet.
INSERT INTO public.medical_records (clinic_id, pet_id)
SELECT p.clinic_id, p.id
FROM public.pets p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.medical_records mr
    WHERE mr.clinic_id = p.clinic_id
      AND mr.pet_id = p.id
      AND mr.deleted_at IS NULL
  );

DO $$
DECLARE
  missing_pet_records int;
BEGIN
  SELECT count(*) INTO missing_pet_records
  FROM public.pets p
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.medical_records mr
      WHERE mr.clinic_id = p.clinic_id
        AND mr.pet_id = p.id
        AND mr.deleted_at IS NULL
    );

  IF missing_pet_records <> 0 THEN
    RAISE EXCEPTION 'medical_records_backfill_incomplete: % active pets have no medical_record', missing_pet_records;
  END IF;
END;
$$;

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS medical_record_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'visits_medical_record_clinic_fk'
      AND conrelid = 'public.visits'::regclass
  ) THEN
    ALTER TABLE public.visits
      ADD CONSTRAINT visits_medical_record_clinic_fk
      FOREIGN KEY (medical_record_id, clinic_id)
      REFERENCES public.medical_records (id, clinic_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS visits_medical_record_idx
  ON public.visits (clinic_id, medical_record_id)
  WHERE medical_record_id IS NOT NULL;

UPDATE public.visits v
SET medical_record_id = mr.id
FROM public.medical_records mr
WHERE mr.clinic_id = v.clinic_id
  AND mr.pet_id = v.pet_id
  AND mr.deleted_at IS NULL
  AND v.medical_record_id IS NULL;

DO $$
DECLARE
  missing_visit_records int;
BEGIN
  SELECT count(*) INTO missing_visit_records
  FROM public.visits
  WHERE deleted_at IS NULL
    AND medical_record_id IS NULL;

  IF missing_visit_records <> 0 THEN
    RAISE EXCEPTION 'visits_medical_record_backfill_incomplete: % active visits have no medical_record_id', missing_visit_records;
  END IF;
END;
$$;

-- Keep duration flexible while preventing nonsensical values.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_duration_minutes_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE duration_minutes <= 0
       OR duration_minutes > 480
  ) THEN
    RAISE EXCEPTION 'appointments_duration_minutes_invalid_values';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_duration_minutes_positive_check'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_duration_minutes_positive_check
      CHECK (duration_minutes > 0 AND duration_minutes <= 480);
  END IF;
END;
$$;

-- Rebuild active overlap constraint after verifying existing active rows do not
-- already conflict under the expanded active status set.
DO $$
DECLARE
  overlap_pairs int;
BEGIN
  WITH active AS (
    SELECT id, clinic_id, scheduled_at, end_at
    FROM public.appointments
    WHERE deleted_at IS NULL
      AND status IN ('scheduled', 'confirmed', 'pending_approval', 'checked_in', 'in_visit')
  )
  SELECT count(*) INTO overlap_pairs
  FROM active a
  JOIN active b
    ON a.id < b.id
   AND a.clinic_id = b.clinic_id
   AND tstzrange(a.scheduled_at, a.end_at, '[)') && tstzrange(b.scheduled_at, b.end_at, '[)');

  IF overlap_pairs <> 0 THEN
    RAISE EXCEPTION 'appointments_active_overlap_existing_data: % overlap pairs', overlap_pairs;
  END IF;
END;
$$;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_active_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_active_overlap
  EXCLUDE USING gist (
    clinic_id WITH =,
    tstzrange(scheduled_at, end_at, '[)') WITH &&
  )
  WHERE (
    deleted_at IS NULL
    AND status IN ('scheduled', 'confirmed', 'pending_approval', 'checked_in', 'in_visit')
  );

-- Structured SOAP fields alongside the existing content text column.
ALTER TABLE public.medical_notes
  ADD COLUMN IF NOT EXISTS subjective text NULL,
  ADD COLUMN IF NOT EXISTS objective text NULL,
  ADD COLUMN IF NOT EXISTS assessment text NULL,
  ADD COLUMN IF NOT EXISTS plan text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid NULL REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medical_notes_status_check'
      AND conrelid = 'public.medical_notes'::regclass
  ) THEN
    ALTER TABLE public.medical_notes
      ADD CONSTRAINT medical_notes_status_check
      CHECK (status IN ('draft', 'approved', 'archived'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS medical_notes_visit_status_idx
  ON public.medical_notes (clinic_id, visit_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS medical_notes_approved_at_idx
  ON public.medical_notes (clinic_id, approved_at DESC)
  WHERE approved_at IS NOT NULL;
