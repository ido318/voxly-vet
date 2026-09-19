-- Sprint 4: Dashboard data layer
-- Adds voice_calls enrichment columns (transcript, ai_summary, call_category, recording_storage_path)
-- to support the new dashboard UI screens.

-- ─────────────────────────────────────────────────────────────
-- 1. voice_calls: enrichment columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS transcript               jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary               text,
  ADD COLUMN IF NOT EXISTS call_category            text
    CHECK (call_category IN ('operation', 'information')),
  ADD COLUMN IF NOT EXISTS recording_storage_path   text;

-- Fast filter by category in the calls screen
CREATE INDEX IF NOT EXISTS voice_calls_clinic_category_idx
  ON public.voice_calls (clinic_id, call_category)
  WHERE call_category IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Supabase Storage bucket for call recordings
--    The bucket itself must be created via the Supabase dashboard or API;
--    the SQL below registers the RLS policy on the objects table.
--    Bucket name: call-recordings (private — no public access)
-- ─────────────────────────────────────────────────────────────

-- Allow clinic members to read their own call recordings via signed URLs
-- (service_role bypasses RLS and is used for upload + signed URL generation)
-- This policy is additive — it's safe to run even if the bucket already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'call_recordings_select_member'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY call_recordings_select_member ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'call-recordings'
          AND (
            -- path: {clinic_id}/{conversation_id}.mp3
            -- Extract clinic_id from path and verify membership
            EXISTS (
              SELECT 1 FROM public.clinic_memberships cm
              WHERE cm.user_id = auth.uid()
                AND cm.clinic_id = (string_to_array(name, '/'))[1]::uuid
            )
          )
        )
    $policy$;
  END IF;
END $$;
