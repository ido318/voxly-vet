-- Phase 4 approved decisions: veterinarian role, manual_visit_summary, prescription discontinued_at

alter type public.clinic_role add value if not exists 'veterinarian';

alter table public.visits
  rename column visit_summary to manual_visit_summary;

alter table public.prescriptions
  add column discontinued_at timestamptz;

alter table public.prescriptions
  add constraint prescriptions_discontinued_at_check
  check (
    (status = 'active' and discontinued_at is null)
    or (status = 'discontinued' and discontinued_at is not null)
  );
