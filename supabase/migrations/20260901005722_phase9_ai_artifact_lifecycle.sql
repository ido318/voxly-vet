create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  artifact_type text not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'draft',
  draft_text text not null check (char_length(trim(draft_text)) > 0),
  structured_payload jsonb not null default '{}'::jsonb,
  model_name text,
  prompt_version text,
  created_by_user_id uuid references auth.users(id),
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ai_summaries_artifact_type_check
    check (artifact_type in ('patient_summary', 'draft_soap', 'client_instructions', 'extracted_tasks')),
  constraint ai_summaries_source_type_check
    check (source_type in ('pet', 'visit', 'call')),
  constraint ai_summaries_status_check
    check (status in ('draft', 'approved', 'rejected')),
  constraint ai_summaries_review_check
    check (
      (status = 'draft' and reviewed_by_user_id is null and reviewed_at is null and rejection_reason is null)
      or (status = 'approved' and reviewed_by_user_id is not null and reviewed_at is not null and rejection_reason is null)
      or (status = 'rejected' and reviewed_by_user_id is not null and reviewed_at is not null and rejection_reason is not null)
    )
);

create trigger ai_summaries_set_updated_at
  before update on public.ai_summaries
  for each row execute function public.set_updated_at();

create index ai_summaries_clinic_source_idx
  on public.ai_summaries (clinic_id, source_type, source_id, created_at desc);

create index ai_summaries_clinic_status_idx
  on public.ai_summaries (clinic_id, status, created_at desc);

alter table public.ai_summaries enable row level security;

create policy ai_summaries_select_member on public.ai_summaries
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy ai_summaries_insert_member on public.ai_summaries
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy ai_summaries_update_member on public.ai_summaries
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
