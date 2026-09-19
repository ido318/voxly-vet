-- Phase 4: medical records (visits, notes, vaccinations, prescriptions)

-- Composite FK support for appointment → visit links
alter table public.appointments
  add constraint appointments_id_clinic_unique unique (id, clinic_id);

create type public.visit_status as enum (
  'in_progress',
  'completed',
  'cancelled'
);

create type public.medical_note_type as enum (
  'soap_subjective',
  'soap_objective',
  'soap_assessment',
  'soap_plan',
  'general',
  'follow_up'
);

create type public.prescription_status as enum (
  'active',
  'discontinued'
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  customer_id uuid not null,
  pet_id uuid not null,
  appointment_id uuid,
  status public.visit_status not null default 'in_progress',
  chief_complaint text,
  visit_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  version int not null default 0,
  created_by_user_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, clinic_id),
  constraint visits_customer_clinic_fk
    foreign key (customer_id, clinic_id)
    references public.customers (id, clinic_id)
    on delete restrict,
  constraint visits_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets (id, clinic_id)
    on delete restrict,
  constraint visits_appointment_clinic_fk
    foreign key (appointment_id, clinic_id)
    references public.appointments (id, clinic_id)
    on delete restrict
);

create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

create index visits_clinic_started_idx
  on public.visits (clinic_id, started_at desc);
create index visits_clinic_pet_idx
  on public.visits (clinic_id, pet_id, started_at desc);
create index visits_clinic_customer_idx
  on public.visits (clinic_id, customer_id);
create index visits_clinic_status_idx
  on public.visits (clinic_id, status);

create table public.medical_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  visit_id uuid not null,
  note_type public.medical_note_type not null default 'general',
  content text not null check (char_length(trim(content)) > 0),
  author_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint medical_notes_visit_clinic_fk
    foreign key (visit_id, clinic_id)
    references public.visits (id, clinic_id)
    on delete restrict
);

create trigger medical_notes_set_updated_at
  before update on public.medical_notes
  for each row execute function public.set_updated_at();

create index medical_notes_visit_idx
  on public.medical_notes (visit_id, created_at desc);
create index medical_notes_clinic_idx
  on public.medical_notes (clinic_id);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  pet_id uuid not null,
  customer_id uuid not null,
  visit_id uuid,
  vaccine_name text not null,
  administered_at timestamptz not null,
  batch_number text,
  next_due_at date,
  notes text,
  administered_by_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vaccinations_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets (id, clinic_id)
    on delete restrict,
  constraint vaccinations_customer_clinic_fk
    foreign key (customer_id, clinic_id)
    references public.customers (id, clinic_id)
    on delete restrict,
  constraint vaccinations_visit_clinic_fk
    foreign key (visit_id, clinic_id)
    references public.visits (id, clinic_id)
    on delete restrict
);

create trigger vaccinations_set_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

create index vaccinations_clinic_pet_idx
  on public.vaccinations (clinic_id, pet_id, administered_at desc);
create index vaccinations_visit_idx
  on public.vaccinations (visit_id)
  where visit_id is not null;

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  visit_id uuid not null,
  pet_id uuid not null,
  medication_name text not null,
  instructions text not null,
  status public.prescription_status not null default 'active',
  prescribed_at timestamptz not null default now(),
  prescribed_by_user_id uuid not null references auth.users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint prescriptions_visit_clinic_fk
    foreign key (visit_id, clinic_id)
    references public.visits (id, clinic_id)
    on delete restrict,
  constraint prescriptions_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets (id, clinic_id)
    on delete restrict
);

create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

create index prescriptions_visit_idx
  on public.prescriptions (visit_id, prescribed_at desc);
create index prescriptions_clinic_pet_idx
  on public.prescriptions (clinic_id, pet_id);

-- RLS
alter table public.visits enable row level security;
alter table public.medical_notes enable row level security;
alter table public.vaccinations enable row level security;
alter table public.prescriptions enable row level security;

create policy visits_select_member on public.visits
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy visits_insert_member on public.visits
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy visits_update_member on public.visits
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy visits_delete_member on public.visits
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));

create policy medical_notes_select_member on public.medical_notes
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy medical_notes_insert_member on public.medical_notes
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy medical_notes_update_member on public.medical_notes
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy medical_notes_delete_member on public.medical_notes
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));

create policy vaccinations_select_member on public.vaccinations
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy vaccinations_insert_member on public.vaccinations
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy vaccinations_update_member on public.vaccinations
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy vaccinations_delete_member on public.vaccinations
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));

create policy prescriptions_select_member on public.prescriptions
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy prescriptions_insert_member on public.prescriptions
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy prescriptions_update_member on public.prescriptions
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy prescriptions_delete_member on public.prescriptions
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));
