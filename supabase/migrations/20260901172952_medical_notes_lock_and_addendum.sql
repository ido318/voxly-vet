-- medical_notes: 24-hour edit lock + addendum support.
-- Additive-only. No application code changes here; a later task builds the
-- app-layer isMedicalNoteLocked() utility and the "add addendum" endpoint on
-- top of what this migration creates.

-- 1. Extend medical_note_type additively so addendum notes and full-SOAP
-- notes can be represented. Keep this separate from any statement that would
-- reference the new values, matching the convention already used by
-- 20260831102332_phase1_enum_additions.sql (Postgres cannot use a value added
-- by ALTER TYPE ... ADD VALUE within the same transaction that added it).
ALTER TYPE public.medical_note_type ADD VALUE IF NOT EXISTS 'addendum';
ALTER TYPE public.medical_note_type ADD VALUE IF NOT EXISTS 'soap_full';

-- 2. Composite unique so parent_note_id (added below) and future FKs can
-- reference medical_notes(id, clinic_id) the same way visits/pets/customers/
-- appointments already do.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medical_notes_id_clinic_unique'
      AND conrelid = 'public.medical_notes'::regclass
  ) THEN
    ALTER TABLE public.medical_notes
      ADD CONSTRAINT medical_notes_id_clinic_unique UNIQUE (id, clinic_id);
  END IF;
END;
$$;

-- 3. Self-referencing parent_note_id: an addendum points back at the note it
-- amends. Requires the UNIQUE (id, clinic_id) added just above.
ALTER TABLE public.medical_notes
  ADD COLUMN IF NOT EXISTS parent_note_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medical_notes_parent_note_clinic_fk'
      AND conrelid = 'public.medical_notes'::regclass
  ) THEN
    ALTER TABLE public.medical_notes
      ADD CONSTRAINT medical_notes_parent_note_clinic_fk
      FOREIGN KEY (parent_note_id, clinic_id)
      REFERENCES public.medical_notes (id, clinic_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS medical_notes_parent_note_idx
  ON public.medical_notes (parent_note_id)
  WHERE parent_note_id IS NOT NULL;

-- 4. 24-hour edit lock. Anchored to created_at (not approved_at) by design:
-- approving a note that was created more than 24 hours ago locks it
-- immediately upon approval. Draft/archived notes stay fully editable
-- regardless of age. Only the clinical-content columns below can trigger the
-- lock; deleted_at (soft delete), updated_at, and version are intentionally
-- never checked, so soft-delete and bookkeeping updates always succeed even
-- on a locked row.
CREATE OR REPLACE FUNCTION public.enforce_medical_note_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'approved'
     AND OLD.created_at <= now() - interval '24 hours'
     AND (
       NEW.content IS DISTINCT FROM OLD.content
       OR NEW.subjective IS DISTINCT FROM OLD.subjective
       OR NEW.objective IS DISTINCT FROM OLD.objective
       OR NEW.assessment IS DISTINCT FROM OLD.assessment
       OR NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.note_type IS DISTINCT FROM OLD.note_type
       OR NEW.status IS DISTINCT FROM OLD.status
     )
  THEN
    RAISE EXCEPTION 'medical note is locked: approved more than 24 hours ago';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'medical_notes_enforce_lock'
      AND tgrelid = 'public.medical_notes'::regclass
  ) THEN
    CREATE TRIGGER medical_notes_enforce_lock
      BEFORE UPDATE ON public.medical_notes
      FOR EACH ROW EXECUTE FUNCTION public.enforce_medical_note_lock();
  END IF;
END;
$$;

-- 5. RLS: no changes. Existing medical_notes policies are untouched; the
-- trigger above is the enforcement layer for the lock/addendum feature.
