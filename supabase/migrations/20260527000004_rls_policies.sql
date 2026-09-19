-- Row Level Security foundation
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_events enable row level security;

-- Profiles: own row only
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Clinics: members can read
create policy clinics_select_member on public.clinics
  for select to authenticated
  using (
    deleted_at is null
    and public.is_clinic_member(id)
  );

create policy clinics_update_admin on public.clinics
  for update to authenticated
  using (public.has_clinic_role(id, array['owner', 'admin']::public.clinic_role[]))
  with check (public.has_clinic_role(id, array['owner', 'admin']::public.clinic_role[]));

-- Clinic memberships
create policy memberships_select_own on public.clinic_memberships
  for select to authenticated
  using (user_id = auth.uid());

create policy memberships_select_clinic_admin on public.clinic_memberships
  for select to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

create policy memberships_insert_admin on public.clinic_memberships
  for insert to authenticated
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

create policy memberships_update_admin on public.clinic_memberships
  for update to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

create policy memberships_delete_admin on public.clinic_memberships
  for delete to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

-- Audit logs: clinic members read; no authenticated insert (service role only)
create policy audit_logs_select_member on public.audit_logs
  for select to authenticated
  using (
    clinic_id is not null
    and public.is_clinic_member(clinic_id)
  );

-- AI events: clinic members read; no authenticated insert (service role only)
create policy ai_events_select_member on public.ai_events
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
