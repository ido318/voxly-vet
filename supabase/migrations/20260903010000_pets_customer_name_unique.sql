-- createOrFindPet (agent/src/lib/store.ts) does a case-insensitive
-- find-then-insert with no DB backstop: two near-simultaneous calls for the
-- same new pet name can both pass the find step and both insert, creating a
-- silent duplicate pet row. customers already has this protection
-- (customers_clinic_phone_unique_idx, 20260527000005) — pets never got the
-- equivalent. lower(name) matches the app's .ilike() lookup, so a case
-- variation ("Rex" vs "REX") is treated as the same conflict here too.
--
-- Existing duplicates would make the unique index creation below fail, so
-- soft-delete every duplicate except the earliest row per
-- (clinic_id, customer_id, lower(name)) group first. Logged via RAISE NOTICE
-- (rather than silently) since this can hide a real pet record if two
-- distinct animals ever legitimately share a name for the same customer.
do $$
declare
  affected_count int;
begin
  with duplicates as (
    select id,
           row_number() over (
             partition by clinic_id, customer_id, lower(name)
             order by created_at, id
           ) as rn
    from public.pets
    where deleted_at is null
  )
  update public.pets
  set deleted_at = now()
  where id in (select id from duplicates where rn > 1);

  get diagnostics affected_count = row_count;
  if affected_count > 0 then
    raise notice 'pets_clinic_customer_name_unique_idx: soft-deleted % duplicate pet row(s) to allow the unique index below to be created', affected_count;
  end if;
end $$;

create unique index pets_clinic_customer_name_unique_idx
  on public.pets (clinic_id, customer_id, lower(name))
  where deleted_at is null;
