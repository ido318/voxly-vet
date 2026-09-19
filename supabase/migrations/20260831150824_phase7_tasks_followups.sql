alter table public.tasks
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists completed_at timestamptz;

alter table public.tasks drop constraint if exists tasks_source_type_check;
alter table public.tasks add constraint tasks_source_type_check
  check (source_type in ('manual', 'visit', 'call', 'follow_up'));

create index if not exists tasks_clinic_source_idx
  on public.tasks (clinic_id, source_type, status, due_at);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  customer_id uuid not null,
  pet_id uuid,
  visit_id uuid,
  voice_call_id uuid references public.voice_calls(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  reason text not null check (char_length(trim(reason)) > 0),
  due_at timestamptz not null,
  status public.task_status not null default 'open',
  completed_at timestamptz,
  completed_by_user_id uuid references auth.users(id),
  created_by_user_id uuid references auth.users(id),
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint follow_ups_customer_clinic_fk
    foreign key (customer_id, clinic_id)
    references public.customers(id, clinic_id) on delete restrict,
  constraint follow_ups_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets(id, clinic_id) on delete restrict,
  constraint follow_ups_visit_clinic_fk
    foreign key (visit_id, clinic_id)
    references public.visits(id, clinic_id) on delete set null
);

create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

create index follow_ups_clinic_status_due_idx
  on public.follow_ups (clinic_id, status, due_at);

create index follow_ups_visit_idx
  on public.follow_ups (visit_id)
  where visit_id is not null;

create index follow_ups_voice_call_idx
  on public.follow_ups (voice_call_id)
  where voice_call_id is not null;

alter table public.follow_ups enable row level security;

create policy follow_ups_select_member on public.follow_ups
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy follow_ups_insert_member on public.follow_ups
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy follow_ups_update_member on public.follow_ups
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy follow_ups_delete_member on public.follow_ups
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));
