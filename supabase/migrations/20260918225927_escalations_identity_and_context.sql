-- Give an escalation the identity the dashboard needs to act on it.
--
-- Until now the table held only reason/urgency plus two nullable call ids, so
-- the "דורש תשומת יד" card showed one Hebrew string and nothing else: no
-- customer name, no number to call back, no link to the call. Everything else
-- was smuggled into free-text columns:
--
--   * /tools/escalate-to-vet wrote the caller's number as
--     notes = 'caller_phone: +9725…'
--   * /tools/triage-pet-case wrote a JSON blob into the same `notes` column
--     with customer_id, pet_id and matched_flags, and truncated the caller's
--     own words to 120 characters inside a composite `reason` string
--   * /tools/request-human-handoff wrote neither — those escalations are
--     completely anonymous
--
-- `notes` is also what a human types when resolving an escalation, so
-- EscalationRepository.resolve() overwrote that JSON — resolving an
-- escalation destroyed its context. Moving context into its own column ends
-- that collision.
--
-- elevenlabs_conversation_id and voice_call_id existed but were never written,
-- so the dashboard's "open the call" affordance could never render.

alter table public.escalations
  add column if not exists customer_id  uuid,
  add column if not exists pet_id       uuid,
  add column if not exists caller_phone text,
  add column if not exists context      jsonb not null default '{}'::jsonb;

-- Composite FKs, matching how visit_charges references its parents: a tenant
-- cannot point an escalation at another clinic's customer. MATCH SIMPLE means
-- the constraint is skipped while customer_id is null, which is what we want
-- for a call from an unknown number.
alter table public.escalations
  drop constraint if exists escalations_customer_clinic_fk;
alter table public.escalations
  add constraint escalations_customer_clinic_fk
  foreign key (customer_id, clinic_id)
  references public.customers (id, clinic_id)
  on delete set null;

alter table public.escalations
  drop constraint if exists escalations_pet_clinic_fk;
alter table public.escalations
  add constraint escalations_pet_clinic_fk
  foreign key (pet_id, clinic_id)
  references public.pets (id, clinic_id)
  on delete set null;

-- The dashboard opens a customer's escalation history from their card.
create index if not exists escalations_clinic_customer_idx
  on public.escalations (clinic_id, customer_id)
  where customer_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Backfill what the old writers buried in text columns.
-- ─────────────────────────────────────────────────────────────

-- 1. triage rows: notes held a JSON object. pg_input_is_valid (PG16+) keeps a
--    single malformed row from aborting the whole migration — `notes` is a
--    free-text column, so nothing guarantees it parses.
update public.escalations
set context = notes::jsonb
where context = '{}'::jsonb
  and notes is not null
  and pg_input_is_valid(notes, 'jsonb')
  and jsonb_typeof(notes::jsonb) = 'object';

-- Promote the ids out of that context, but only where they still resolve:
-- a customer deleted since the escalation was raised must not fail the FK.
update public.escalations e
set customer_id = (e.context ->> 'customer_id')::uuid
where e.customer_id is null
  and pg_input_is_valid(coalesce(e.context ->> 'customer_id', ''), 'uuid')
  and exists (
    select 1 from public.customers c
    where c.id = (e.context ->> 'customer_id')::uuid
      and c.clinic_id = e.clinic_id
  );

update public.escalations e
set pet_id = (e.context ->> 'pet_id')::uuid
where e.pet_id is null
  and pg_input_is_valid(coalesce(e.context ->> 'pet_id', ''), 'uuid')
  and exists (
    select 1 from public.pets p
    where p.id = (e.context ->> 'pet_id')::uuid
      and p.clinic_id = e.clinic_id
  );

-- `notes` is the human's field from here on; the machine context now lives in
-- its own column and resolving an escalation can no longer destroy it.
update public.escalations
set notes = null
where notes is not null
  and pg_input_is_valid(notes, 'jsonb')
  and jsonb_typeof(notes::jsonb) = 'object';

-- 2. escalate-to-vet rows: notes was 'caller_phone: +9725…'.
update public.escalations
set
  caller_phone = trim(substring(notes from 'caller_phone:\s*(.+)$')),
  notes = null
where caller_phone is null
  and notes like 'caller\_phone:%';

-- 3. Link to the call, and through it to the customer the agent already
--    resolved on voice_calls. Both columns existed and were never populated.
update public.escalations e
set
  voice_call_id = coalesce(e.voice_call_id, v.id),
  customer_id   = coalesce(e.customer_id, v.customer_id),
  caller_phone  = coalesce(e.caller_phone, v.from_number)
from public.voice_calls v
where v.elevenlabs_conversation_id = e.elevenlabs_conversation_id
  and v.clinic_id = e.clinic_id
  and e.elevenlabs_conversation_id is not null;

-- Clear a backfilled phone that is not a number anyone can call. The agent
-- stores 'unknown' on voice_calls when the caller id is withheld, and older
-- rows may carry the '+' that the pre-2026-09-18 normalisePhone produced for
-- empty input.
update public.escalations
set caller_phone = null
where caller_phone is not null
  and caller_phone !~ '^\+972[2-9][0-9]{7,8}$';

-- The agent writes with the service role, which bypasses RLS, so this table
-- never had an INSERT policy. Add one anyway: the dashboard will eventually
-- raise escalations too, and a table whose only write path is a bypass is one
-- migration away from silently refusing writes.
drop policy if exists escalations_insert_member on public.escalations;
create policy escalations_insert_member on public.escalations
  for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

comment on column public.escalations.context is
  'Structured triage context: decision, matched_flags, after_hours, symptoms_he (full, untruncated). Written by the agent; never overwritten by a human resolving the escalation — that goes in notes.';
comment on column public.escalations.caller_phone is
  'E.164. The number to call back, previously smuggled into notes as "caller_phone: …".';
