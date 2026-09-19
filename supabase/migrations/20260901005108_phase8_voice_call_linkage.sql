alter table public.voice_calls
  add column if not exists pet_id uuid,
  add column if not exists appointment_id uuid,
  add column if not exists visit_id uuid;

alter table public.voice_calls
  add constraint voice_calls_pet_clinic_fk
  foreign key (pet_id, clinic_id)
  references public.pets(id, clinic_id)
  on delete set null;

alter table public.voice_calls
  add constraint voice_calls_appointment_clinic_fk
  foreign key (appointment_id, clinic_id)
  references public.appointments(id, clinic_id)
  on delete set null;

alter table public.voice_calls
  add constraint voice_calls_visit_clinic_fk
  foreign key (visit_id, clinic_id)
  references public.visits(id, clinic_id)
  on delete set null;

create index if not exists voice_calls_clinic_pet_idx
  on public.voice_calls (clinic_id, pet_id)
  where pet_id is not null;

create index if not exists voice_calls_clinic_appointment_idx
  on public.voice_calls (clinic_id, appointment_id)
  where appointment_id is not null;

create index if not exists voice_calls_clinic_visit_idx
  on public.voice_calls (clinic_id, visit_id)
  where visit_id is not null;
