-- Dashboard-editable clinic settings (business hours, visit prices, contact info).
-- Stored as jsonb so the shape can grow without further migrations; validated at the app layer.
-- Existing RLS policies on public.clinics (clinics_select_member / clinics_update_admin) already
-- cover this column — no policy changes needed.
alter table public.clinics
  add column settings jsonb not null default '{}'::jsonb;
