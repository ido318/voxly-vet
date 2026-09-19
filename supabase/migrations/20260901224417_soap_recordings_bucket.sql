-- Voice SOAP Generator: Storage bucket RLS for dictation recordings
-- Area 3, Step 1 — registers the RLS policy for the new `soap-recordings` bucket,
-- mirroring the `call-recordings` policy added in 20260612000017_sprint4_dashboard.sql.
-- No table changes here; later tasks in this plan add transcription + AI parsing + UI.

-- ─────────────────────────────────────────────────────────────
-- Supabase Storage bucket for SOAP dictation recordings
--    The bucket itself must be created via the Supabase dashboard or API;
--    the SQL below registers the RLS policy on the objects table.
--    Bucket name: soap-recordings (private — no public access)
-- ─────────────────────────────────────────────────────────────

-- Allow clinic members to read their own SOAP dictation recordings via signed URLs
-- (service_role bypasses RLS and is used for upload + signed URL generation)
-- This policy is additive — it's safe to run even if the bucket already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'soap_recordings_select_member'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY soap_recordings_select_member ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'soap-recordings'
          AND (
            -- path: {clinic_id}/{visit_id}/{uuid}.webm
            -- Extract clinic_id from the first path segment and verify membership
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
