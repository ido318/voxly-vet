-- Local development seed only (no real PII)
insert into public.clinics (id, name, slug, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'Dana''s Clinic',
  'noas-clinic',
  'Asia/Jerusalem'
)
on conflict (slug) do nothing;
