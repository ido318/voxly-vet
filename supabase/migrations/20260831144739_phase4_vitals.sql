-- Phase 4: vitals history for pet medical records.
-- Additive only: creates a new clinical table used by medical record timeline.

CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  visit_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric(6, 2),
  temperature_c numeric(4, 1),
  heart_rate_bpm int,
  respiratory_rate_bpm int,
  mucous_membrane text,
  capillary_refill_time text,
  body_condition_score numeric(3, 1),
  pain_score int,
  hydration_status text,
  notes text,
  recorded_by_user_id uuid REFERENCES auth.users (id),
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT vitals_customer_clinic_fk
    FOREIGN KEY (customer_id, clinic_id)
    REFERENCES public.customers (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT vitals_pet_clinic_fk
    FOREIGN KEY (pet_id, clinic_id)
    REFERENCES public.pets (id, clinic_id) ON DELETE RESTRICT,
  CONSTRAINT vitals_visit_clinic_fk
    FOREIGN KEY (visit_id, clinic_id)
    REFERENCES public.visits (id, clinic_id) ON DELETE SET NULL,
  CONSTRAINT vitals_weight_kg_check
    CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 250)),
  CONSTRAINT vitals_temperature_c_check
    CHECK (temperature_c IS NULL OR (temperature_c >= 30 AND temperature_c <= 45)),
  CONSTRAINT vitals_heart_rate_bpm_check
    CHECK (heart_rate_bpm IS NULL OR (heart_rate_bpm > 0 AND heart_rate_bpm <= 400)),
  CONSTRAINT vitals_respiratory_rate_bpm_check
    CHECK (respiratory_rate_bpm IS NULL OR (respiratory_rate_bpm > 0 AND respiratory_rate_bpm <= 200)),
  CONSTRAINT vitals_body_condition_score_check
    CHECK (body_condition_score IS NULL OR (body_condition_score >= 1 AND body_condition_score <= 9)),
  CONSTRAINT vitals_pain_score_check
    CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10))
);

CREATE TRIGGER vitals_set_updated_at
  BEFORE UPDATE ON public.vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX vitals_clinic_pet_recorded_idx
  ON public.vitals (clinic_id, pet_id, recorded_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX vitals_visit_idx
  ON public.vitals (visit_id)
  WHERE visit_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY vitals_select_member ON public.vitals
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY vitals_insert_member ON public.vitals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY vitals_update_member ON public.vitals
  FOR UPDATE TO authenticated
  USING (public.is_clinic_member(clinic_id))
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY vitals_delete_member ON public.vitals
  FOR DELETE TO authenticated
  USING (public.is_clinic_member(clinic_id));
