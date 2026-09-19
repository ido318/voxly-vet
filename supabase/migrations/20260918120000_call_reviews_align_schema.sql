-- Align call_reviews with the columns current code writes/reads
-- (agent logConversation/qaAnalyzer + app CallReviewRepository).
--
-- 20260828000022 created elevenlabs_conversation_id / evaluation_results /
-- flagged_criteria. Production was later repaired by hand to conversation_id
-- + ElevenLabs GetConversationResponseModel fields. A fresh db reset still
-- built the old shape, so upserts on conversation_id failed. This migration
-- is additive and idempotent for both histories.

alter table public.call_reviews add column if not exists conversation_id text;
alter table public.call_reviews add column if not exists agent_id text;
alter table public.call_reviews add column if not exists version_id text;
alter table public.call_reviews add column if not exists call_successful text;
alter table public.call_reviews add column if not exists transcript_summary text;
alter table public.call_reviews add column if not exists evaluation_criteria_results jsonb;
alter table public.call_reviews add column if not exists data_collection_results jsonb;
alter table public.call_reviews add column if not exists transcript jsonb;
alter table public.call_reviews add column if not exists call_duration_secs integer;
alter table public.call_reviews add column if not exists flagged_reasons text[];

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'call_reviews'
      and column_name = 'elevenlabs_conversation_id'
  ) then
    update public.call_reviews
    set conversation_id = coalesce(conversation_id, elevenlabs_conversation_id)
    where conversation_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'call_reviews'
      and column_name = 'evaluation_results'
  ) then
    update public.call_reviews
    set evaluation_criteria_results = coalesce(evaluation_criteria_results, evaluation_results)
    where evaluation_criteria_results is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'call_reviews'
      and column_name = 'flagged_criteria'
  ) then
    update public.call_reviews
    set flagged_reasons = coalesce(flagged_reasons, flagged_criteria)
    where flagged_reasons is null;
  end if;
end $$;

update public.call_reviews
set
  conversation_id = coalesce(conversation_id, id::text),
  agent_id = coalesce(agent_id, 'unknown'),
  evaluation_criteria_results = coalesce(evaluation_criteria_results, '{}'::jsonb),
  data_collection_results = coalesce(data_collection_results, '{}'::jsonb),
  transcript = coalesce(transcript, '[]'::jsonb),
  flagged_reasons = coalesce(flagged_reasons, '{}'::text[]);

alter table public.call_reviews
  alter column conversation_id set not null,
  alter column agent_id set not null,
  alter column evaluation_criteria_results set not null,
  alter column data_collection_results set not null,
  alter column transcript set not null,
  alter column flagged_reasons set not null;

alter table public.call_reviews
  alter column evaluation_criteria_results set default '{}'::jsonb,
  alter column data_collection_results set default '{}'::jsonb,
  alter column transcript set default '[]'::jsonb,
  alter column flagged_reasons set default '{}'::text[];

create unique index if not exists call_reviews_conversation_id_key
  on public.call_reviews (conversation_id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'call_reviews_elevenlabs_conversation_id_key'
  ) then
    alter table public.call_reviews
      drop constraint call_reviews_elevenlabs_conversation_id_key;
  end if;
end $$;
