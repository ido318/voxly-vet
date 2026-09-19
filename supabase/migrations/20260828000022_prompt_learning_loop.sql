-- Prompt learning loop for the Tomer voice agent: per-call evaluation logging
-- (call_reviews) and weekly Claude-proposed prompt patches awaiting human
-- approval before publish (prompt_suggestions).

create table if not exists public.call_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  elevenlabs_conversation_id text not null,
  evaluation_results jsonb not null,
  flagged boolean not null default false,
  flagged_criteria text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (elevenlabs_conversation_id)
);

create index if not exists call_reviews_clinic_id_created_at_idx
  on public.call_reviews (clinic_id, created_at);
create index if not exists call_reviews_flagged_created_at_idx
  on public.call_reviews (flagged, created_at);

-- Deny-by-default: no anon/authenticated policies. All access goes through the
-- service-role key (agent/'s webhook + weekly job, app/'s admin-only repository),
-- matching the pattern used by visit_shares.
alter table public.call_reviews enable row level security;

comment on table public.call_reviews is 'Per-call ElevenLabs evaluation-criteria results, flagged for the weekly prompt-learning analysis job.';

create table if not exists public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'published', 'failed_regression')),
  pattern_summary text not null,
  suggested_prompt text not null,
  supporting_call_review_ids uuid[] not null default '{}',
  regression_result jsonb,
  previous_prompt jsonb,
  publish_result jsonb,
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists prompt_suggestions_clinic_id_status_idx
  on public.prompt_suggestions (clinic_id, status);

alter table public.prompt_suggestions enable row level security;

comment on table public.prompt_suggestions is 'Weekly Claude-proposed prompt patches for Tomer, pending human approval + regression test before publish.';
