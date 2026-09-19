-- call_reviews already existed in production with a schema that diverged from
-- 20260828000022_prompt_learning_loop.sql (its `create table if not exists`
-- silently no-op'd against the pre-existing table). The live table mirrors
-- ElevenLabs' GetConversationResponseModel directly (conversation_id, agent_id,
-- version_id, call_successful, transcript_summary, evaluation_criteria_results,
-- data_collection_results, transcript, call_duration_secs, flagged,
-- flagged_reasons) but has no clinic_id, breaking the multi-tenant-by-clinic_id
-- convention every other data table follows. Table is empty (0 rows) so this
-- is a plain additive column, no backfill needed.

-- IF NOT EXISTS: on a fresh database, 20260828000022_prompt_learning_loop.sql's
-- own `create table if not exists` already defines clinic_id correctly (it only
-- no-op'd against production's pre-existing, manually-created table) - without
-- this guard, a full local/CI reset fails with "column already exists".
alter table public.call_reviews
  add column if not exists clinic_id uuid not null references public.clinics(id);

create index if not exists call_reviews_clinic_id_created_at_idx
  on public.call_reviews (clinic_id, created_at);
