-- Phase 6: voice calls (Twilio inbound infrastructure)

create type public.voice_call_direction as enum ('inbound', 'outbound');

create type public.voice_call_status as enum (
  'queued',
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'busy',
  'no_answer',
  'canceled'
);

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  direction public.voice_call_direction not null default 'inbound',
  status public.voice_call_status not null default 'ringing',
  from_number text not null,
  to_number text not null,
  twilio_call_sid text not null unique,
  twilio_parent_call_sid text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  recording_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger voice_calls_set_updated_at
  before update on public.voice_calls
  for each row execute function public.set_updated_at();

create index voice_calls_clinic_started_idx
  on public.voice_calls (clinic_id, started_at desc);
create index voice_calls_clinic_customer_idx
  on public.voice_calls (clinic_id, customer_id);
create index voice_calls_twilio_sid_idx
  on public.voice_calls (twilio_call_sid);

alter table public.voice_calls enable row level security;

create policy voice_calls_select_member on public.voice_calls
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
