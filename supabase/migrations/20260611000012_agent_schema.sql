-- Phase 7 (Agent): unified schema bridge
-- Extends voice_calls for ElevenLabs Conversational AI (Tomer)
-- Adds escalations table for Tomer's escalation events
-- Adds agent_name column so dashboard can distinguish DTMF vs AI calls

-- ─────────────────────────────────────────────────────────────
-- 1. voice_calls: support ElevenLabs-only records
-- ─────────────────────────────────────────────────────────────

-- Track ElevenLabs conversation ID (unique — one row per EL conversation)
ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id text,
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT NULL;

-- Relax NOT NULL so ElevenLabs-originated records don't need a Twilio SID
ALTER TABLE public.voice_calls
  ALTER COLUMN twilio_call_sid DROP NOT NULL;

-- Guard: every voice_calls row must have at least one identifier
-- (elevenlabs_conversation_id column must exist first)
ALTER TABLE public.voice_calls
  ADD CONSTRAINT voice_calls_has_identifier
  CHECK (twilio_call_sid IS NOT NULL OR elevenlabs_conversation_id IS NOT NULL);

ALTER TABLE public.voice_calls
  ADD CONSTRAINT voice_calls_elevenlabs_conv_unique
  UNIQUE (elevenlabs_conversation_id);

CREATE INDEX IF NOT EXISTS voice_calls_elevenlabs_conv_idx
  ON public.voice_calls (elevenlabs_conversation_id)
  WHERE elevenlabs_conversation_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. escalations (Tomer's escalation events visible in dashboard)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.escalations (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                   uuid        NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  voice_call_id               uuid        REFERENCES public.voice_calls (id) ON DELETE SET NULL,
  elevenlabs_conversation_id  text,
  reason                      text        NOT NULL,
  urgency                     int         NOT NULL CHECK (urgency BETWEEN 1 AND 10),
  resolved_at                 timestamptz,
  resolved_by                 uuid        REFERENCES auth.users (id),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER escalations_set_updated_at
  BEFORE UPDATE ON public.escalations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX escalations_clinic_created_idx
  ON public.escalations (clinic_id, created_at DESC);

-- Fast query for open high-urgency escalations in the dashboard
CREATE INDEX escalations_clinic_open_urgency_idx
  ON public.escalations (clinic_id, urgency DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

-- Clinic members can read escalations (service role writes bypass RLS)
CREATE POLICY escalations_select_member ON public.escalations
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

-- Admins/owners can resolve escalations from the dashboard
CREATE POLICY escalations_update_admin ON public.escalations
  FOR UPDATE TO authenticated
  USING  (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));
