alter table public.prescriptions
  drop constraint if exists prescriptions_discontinued_at_check;

alter table public.prescriptions
  add constraint prescriptions_discontinued_at_check
  check (
    (
      status in ('draft'::public.prescription_status, 'active'::public.prescription_status)
      and discontinued_at is null
    )
    or (
      status = 'discontinued'::public.prescription_status
      and discontinued_at is not null
    )
  );
