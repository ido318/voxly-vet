-- Site-wide role (not clinic_memberships.role, which is per-clinic). Only
-- provider_admin unlocks /provider-admin/* — a separate, non-clinic-scoped
-- ops surface for QA review and prompt-suggestion approval.
alter table public.profiles add column role text not null default 'clinic_user'
  check (role in ('clinic_user', 'provider_admin'));

comment on column public.profiles.role is
  'Site-wide role. clinic_user (default) sees only /dashboard; provider_admin also sees /provider-admin, unscoped by clinic.';

-- profiles_update_own has no column-level restriction — any authenticated
-- user could otherwise self-promote by updating their own row's role via
-- the anon key (RLS only restricts which ROW, not which COLUMNS). Block
-- role changes specifically when the connection is a regular user session;
-- direct/service-role writes (SQL editor, migrations, backend service-role
-- calls) are unaffected since auth.role() is not 'authenticated' there.
create or replace function public.prevent_profiles_role_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.role() = 'authenticated' then
    raise exception 'profiles.role cannot be changed from a user session; use the service role';
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_profiles_role_self_update();
