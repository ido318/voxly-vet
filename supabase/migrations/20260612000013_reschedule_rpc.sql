-- Atomic reschedule: cancel old appointment + insert new in one transaction.
-- Called by the agent via service-role key (bypasses RLS).

create or replace function public.reschedule_appointment(
  p_clinic_id        uuid,
  p_old_appointment_id uuid,
  p_new_scheduled_at timestamptz,
  p_duration_minutes int default 30
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_old    public.appointments%rowtype;
begin
  -- Lock and fetch the old appointment
  select * into v_old
    from public.appointments
   where id = p_old_appointment_id
     and clinic_id = p_clinic_id
   for update;

  if not found then
    raise exception 'appointment_not_found: %', p_old_appointment_id;
  end if;

  if v_old.status not in ('scheduled', 'confirmed') then
    raise exception 'appointment_not_active: status is %', v_old.status;
  end if;

  -- Insert new appointment first; GIST constraint prevents overlap
  insert into public.appointments (
    clinic_id,
    customer_id,
    pet_id,
    appointment_type,
    status,
    source,
    scheduled_at,
    end_at,
    duration_minutes,
    reason,
    created_by_user_id
  ) values (
    p_clinic_id,
    v_old.customer_id,
    v_old.pet_id,
    v_old.appointment_type,
    'scheduled',
    'phone',
    p_new_scheduled_at,
    p_new_scheduled_at + make_interval(mins => p_duration_minutes),
    p_duration_minutes,
    v_old.reason,
    null
  )
  returning id into v_new_id;

  -- Cancel old only after new inserted successfully
  update public.appointments
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = 'rescheduled'
   where id = p_old_appointment_id;

  return v_new_id;
end;
$$;

-- Only service-role can execute (agent bypasses RLS; dashboard staff don't need this path)
revoke execute on function public.reschedule_appointment(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant  execute on function public.reschedule_appointment(uuid, uuid, timestamptz, int) to service_role;
