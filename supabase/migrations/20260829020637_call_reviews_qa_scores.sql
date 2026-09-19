-- Per-call QA scoring (Provider Admin QA Phase 1+2, see
-- docs/superpowers/specs/2026-08-29-provider-admin-qa-phase1-2-design.md).
-- Adds a 0-10 scored rubric (6 dimensions) written by a new per-call Claude
-- QA analyzer, alongside the existing free ElevenLabs-sourced flagged/
-- flagged_reasons columns (left untouched). is_exception replaces flagged
-- as the weekly analyzeConversations.ts job's trigger field.

alter table public.call_reviews add column overall_score numeric(4,2);
alter table public.call_reviews add column empathy_score numeric(4,2);
alter table public.call_reviews add column naturalness_score numeric(4,2);
alter table public.call_reviews add column accuracy_score numeric(4,2);
alter table public.call_reviews add column protocol_score numeric(4,2);
alter table public.call_reviews add column safety_score numeric(4,2);
alter table public.call_reviews add column resolution_score numeric(4,2);
alter table public.call_reviews add column is_exception boolean not null default false;
alter table public.call_reviews add column exception_severity text
  check (exception_severity in ('none', 'low', 'medium', 'high', 'critical'));
alter table public.call_reviews add column strengths text[] not null default '{}';
alter table public.call_reviews add column problems jsonb not null default '[]'::jsonb;
alter table public.call_reviews add column reviewer_summary text;
alter table public.call_reviews add column analyzer_model text;
alter table public.call_reviews add column qa_analyzed_at timestamptz;

create index if not exists call_reviews_is_exception_idx
  on public.call_reviews (is_exception, created_at desc)
  where is_exception = true;
