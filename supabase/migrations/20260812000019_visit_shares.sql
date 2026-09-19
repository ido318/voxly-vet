-- Shareable, tokenized links for sending a visit summary + prescriptions to the client (via SMS).
create table if not exists public.visit_shares (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  visit_id uuid not null references public.visits(id),
  token text not null unique,
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp', 'link')),
  recipient_phone text,
  created_by_user_id uuid references auth.users(id),
  twilio_message_sid text,
  sent_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists visit_shares_visit_id_idx on public.visit_shares (visit_id);
create index if not exists visit_shares_token_idx on public.visit_shares (token);

-- Deny-by-default: no anon/authenticated policies. All access goes through the
-- service-role key in server code (dashboard create + public token page read),
-- which bypasses RLS. The token itself is the capability.
alter table public.visit_shares enable row level security;

comment on table public.visit_shares is 'Tokenized share links for delivering visit summaries and prescriptions to clients.';
