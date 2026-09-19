-- Phase 5: AI visit summary (accepted text only; drafts live in ai_events until accept)

alter table public.visits
  add column if not exists ai_visit_summary text,
  add column if not exists ai_summary_generated_at timestamptz,
  add column if not exists ai_summary_accepted_by_user_id uuid references auth.users (id);
