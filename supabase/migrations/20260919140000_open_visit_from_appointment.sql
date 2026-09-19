-- H4: one active visit per appointment, and create-visit + mark in_visit
-- as a single transaction so a double-click cannot insert two visits.
--
-- Partial unique index ignores walk-in visits (appointment_id IS NULL) and
-- soft-deleted rows. The RPC locks the appointment, returns an existing
-- visit if one is already linked (idempotent), otherwise inserts the visit
-- and flips status to in_visit in the same transaction.
--
-- security invoker: the calling dashboard user still hits visits_insert_member
-- and appointments update RLS. No service-role bypass.

create unique index if not exists visits_appointment_id_active_unique
  on public.visits (appointment_id)
  where appointment_id is not null and deleted_at is null;

create or replace function public.open_visit_from_appointment(
  p_appointment_id uuid,
  p_expected_version int,
  p_medical_record_id uuid,
  p_chief_complaint text,
  p_created_by_user_id uuid
)
returns public.visits
language plpgsql
security invoker
as $$
declare
  v_appt public.appointments;
  v_visit public.visits;
begin
  select * into v_appt
  from public.appointments
  where id = p_appointment_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  select * into v_visit
  from public.visits
  where appointment_id = p_appointment_id
    and deleted_at is null;

  if found then
    return v_visit;
  end if;

  if v_appt.version is distinct from p_expected_version then
    raise exception 'stale_version' using errcode = 'P0001';
  end if;

  if v_appt.status is distinct from 'checked_in' then
    raise exception 'invalid_status: %', v_appt.status using errcode = 'P0001';
  end if;

  begin
    insert into public.visits (
      clinic_id,
      customer_id,
      pet_id,
      appointment_id,
      medical_record_id,
      chief_complaint,
      created_by_user_id
    ) values (
      v_appt.clinic_id,
      v_appt.customer_id,
      v_appt.pet_id,
      v_appt.id,
      p_medical_record_id,
      p_chief_complaint,
      p_created_by_user_id
    )
    returning * into v_visit;
  exception
    when unique_violation then
      select * into v_visit
      from public.visits
      where appointment_id = p_appointment_id
        and deleted_at is null;
      if not found then
        raise;
      end if;
      return v_visit;
  end;

  update public.appointments
  set
    status = 'in_visit',
    changed_via = 'dashboard',
    version = version + 1
  where id = p_appointment_id
    and version = p_expected_version
    and deleted_at is null;

  if not found then
    raise exception 'stale_version' using errcode = 'P0001';
  end if;

  return v_visit;
end;
$$;

revoke execute on function public.open_visit_from_appointment(uuid, int, uuid, text, uuid)
  from public, anon;
grant execute on function public.open_visit_from_appointment(uuid, int, uuid, text, uuid)
  to authenticated;
