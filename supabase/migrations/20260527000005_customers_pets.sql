-- Phase 2: customers + pets domain foundation
create type public.customer_status as enum ('active', 'inactive');
create type public.pet_status as enum ('active', 'inactive');
create type public.contact_method as enum ('phone', 'sms', 'email', 'whatsapp');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  address text,
  preferred_contact_method public.contact_method not null default 'phone',
  notes text,
  status public.customer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, clinic_id)
);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_clinic_created_idx
  on public.customers (clinic_id, created_at desc);
create index customers_clinic_name_idx
  on public.customers (clinic_id, full_name);
create unique index customers_clinic_phone_unique_idx
  on public.customers (clinic_id, phone)
  where deleted_at is null and phone is not null;
create unique index customers_clinic_email_unique_idx
  on public.customers (clinic_id, email)
  where deleted_at is null and email is not null;

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  customer_id uuid not null,
  name text not null,
  species text not null,
  breed text,
  sex text,
  birth_date date,
  weight numeric(6, 2),
  chip_number text,
  is_neutered boolean not null default false,
  allergies text,
  chronic_conditions text,
  current_medications text,
  notes text,
  profile_image_url text,
  status public.pet_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, clinic_id),
  constraint pets_customer_fk
    foreign key (customer_id, clinic_id)
    references public.customers (id, clinic_id)
    on delete restrict
);

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

create index pets_clinic_customer_idx
  on public.pets (clinic_id, customer_id);
create index pets_clinic_name_idx
  on public.pets (clinic_id, name);
create unique index pets_clinic_chip_unique_idx
  on public.pets (clinic_id, chip_number)
  where deleted_at is null and chip_number is not null;

alter table public.customers enable row level security;
alter table public.pets enable row level security;

-- Customers are clinic-scoped and only visible to clinic members.
create policy customers_select_member on public.customers
  for select to authenticated
  using (public.is_clinic_member(clinic_id) and deleted_at is null);

create policy customers_insert_member on public.customers
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy customers_update_member on public.customers
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy customers_delete_member on public.customers
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));

-- Pets follow the same clinic membership rules.
create policy pets_select_member on public.pets
  for select to authenticated
  using (public.is_clinic_member(clinic_id) and deleted_at is null);

create policy pets_insert_member on public.pets
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

create policy pets_update_member on public.pets
  for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy pets_delete_member on public.pets
  for delete to authenticated
  using (public.is_clinic_member(clinic_id));
