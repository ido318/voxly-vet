-- Renames Tomer's prompt-suggestion table away from `prompt_suggestions`.
-- That name now belongs to a different, unrelated PIMS-wide table (agent_id-scoped,
-- not clinic_id-scoped) created out-of-band directly in the cloud DB — confirmed
-- intentional, not schema drift. This creates Tomer's own table under its own name,
-- combining the original prompt_suggestions definition (20260828000022_prompt_learning_loop.sql)
-- with the stage-2 category-aware columns (20260831130000_prompt_suggestions_categories.sql,
-- which never successfully applied against the live DB because of this collision).
create table if not exists public.tomer_prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'published', 'failed_regression')),
  category text not null default 'prompt'
    check (category in ('prompt','knowledge_base','tool','backend_logic','conversation_flow')),
  target_file text,
  pattern_summary text not null,
  proposed_change text,
  root_cause text,
  suggested_prompt text,
  supporting_call_review_ids uuid[] not null default '{}',
  regression_result jsonb,
  previous_prompt jsonb,
  publish_result jsonb,
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tomer_prompt_suggestions_clinic_id_status_idx
  on public.tomer_prompt_suggestions (clinic_id, status);

alter table public.tomer_prompt_suggestions enable row level security;

comment on table public.tomer_prompt_suggestions is 'Weekly Claude-proposed fixes for Tomer (prompt rewrites, KB/tool/backend/flow issues), pending human approval + regression test before publish. Named distinctly from public.prompt_suggestions, which is a separate PIMS-wide, agent_id-scoped table.';
comment on column public.tomer_prompt_suggestions.category is
  'What kind of fix this is — only "prompt" suggestions get auto-published via ElevenLabs regression+publish; everything else is marked approved for manual follow-through.';
