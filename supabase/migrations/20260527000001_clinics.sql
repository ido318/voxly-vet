-- Clinics foundation (multi-clinic from day one)
create type public.clinic_role as enum ('owner', 'admin', 'staff');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clinics_slug_idx on public.clinics (slug) where deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();
