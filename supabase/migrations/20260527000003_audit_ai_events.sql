-- Audit and AI event logging foundation
create type public.audit_actor_type as enum ('user', 'system', 'ai');

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id),
  actor_type public.audit_actor_type not null,
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_payload jsonb,
  after_payload jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_clinic_created_idx on public.audit_logs (clinic_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.ai_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id),
  source_type text not null,
  source_id text,
  agent_name text not null,
  event_type text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  confidence numeric,
  model_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_events_clinic_created_idx on public.ai_events (clinic_id, created_at desc);
