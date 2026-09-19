-- Phase 3: appointments + calendar foundation
create type public.appointment_type as enum (
  'checkup',
  'vaccination',
  'consultation',
  'urgent',
  'follow_up',
  'other'
);

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.appointment_source as enum (
  'phone',
  'front_desk',
  'online',
  'internal',
  'other'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  customer_id uuid not null,
  pet_id uuid not null,
  appointment_type public.appointment_type not null,
  status public.appointment_status not null default 'scheduled',
  source public.appointment_source not null default 'front_desk',
  scheduled_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null check (duration_minutes = 30),
  reason text,
  notes text,
  version int not null default 0,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references auth.users (id),
  cancellation_reason text,
  created_by_user_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint appointments_customer_clinic_fk
    foreign key (customer_id, clinic_id)
    references public.customers (id, clinic_id)
    on delete restrict,
  constraint appointments_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets (id, clinic_id)
    on delete restrict
);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace function public.set_appointment_end_at()
returns trigger
language plpgsql
as $$
begin
  new.end_at = new.scheduled_at + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

create trigger appointments_set_end_at
  before insert or update on public.appointments
  for each row execute function public.set_appointment_end_at();

create index appointments_clinic_scheduled_idx
  on public.appointments (clinic_id, scheduled_at);
create index appointments_clinic_status_scheduled_idx
  on public.appointments (clinic_id, status, scheduled_at);
create index appointments_clinic_customer_idx
  on public.appointments (clinic_id, customer_id);
create index appointments_clinic_pet_idx
  on public.appointments (clinic_id, pet_id);

-- DB-level safety barrier: block overlaps for active appointments only.
create extension if not exists btree_gist;
alter table public.appointments add constraint appointments_no_active_overlap
  exclude using gist (
    clinic_id with =,
    tstzrange(scheduled_at, end_at, '[)') with &&
  )
  where (
    deleted_at is null
    and status in ('scheduled', 'confirmed')
  );

alter table public.appointments enable row level security;

create policy appointments_select_member on public.appointments
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy appointments_insert_member on public.appointments
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy appointments_update_member on public.appointments
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy appointments_delete_member on public.appointments
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));
