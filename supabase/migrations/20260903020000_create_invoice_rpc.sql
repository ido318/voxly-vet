-- invoice.service.ts computed the next invoice_number as
-- "count(*) + 1" in application code, then inserted in a separate query —
-- two concurrent createInvoice calls for the same clinic could both read the
-- same count and both attempt the same invoice_number, hitting
-- invoices_clinic_number_unique (23505) as a generic 500 instead of the
-- request that actually needed the number just getting the next one. This
-- RPC makes numbering-and-insert one atomic operation.
--
-- invoice_number_counters holds one row per (clinic_id, year): the atomic
-- "insert ... on conflict ... do update ... returning" in the function below
-- is what makes the increment race-free (no advisory lock needed), and
-- unlike `select count(*) from invoices`, bumping a single counter row is
-- O(1) regardless of how many invoices the clinic has accumulated. Counting
-- from invoices directly also silently ignored the year embedded in
-- invoice_number's format: INV-2027-004 could appear as the clinic's very
-- first invoice of 2027 if it already had 3 invoices total from 2026 —
-- scoping the counter by year fixes that too, and gives every year its own
-- 001-and-up sequence as the invoice_number format implies.
create table if not exists public.invoice_number_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  year      int  not null,
  next_seq  int  not null default 1,
  primary key (clinic_id, year)
);

alter table public.invoice_number_counters enable row level security;

-- Mirrors invoices_insert_admin (20260829010000): only the roles allowed to
-- create an invoice may bump its numbering counter. security invoker below
-- means create_invoice runs as the calling user, so these policies (not a
-- security-definer bypass) are what actually govern access to this table.
create policy invoice_number_counters_select_admin on public.invoice_number_counters
  for select to authenticated
  using (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

create policy invoice_number_counters_insert_admin on public.invoice_number_counters
  for insert to authenticated
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

create policy invoice_number_counters_update_admin on public.invoice_number_counters
  for update to authenticated
  using  (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]))
  with check (public.has_clinic_role(clinic_id, array['owner', 'admin']::public.clinic_role[]));

-- security invoker (the default — stated explicitly) so this runs as the
-- calling user: the same invoices_insert_admin RLS policy that already
-- gates a plain insert() still applies here.
create or replace function public.create_invoice(
  p_clinic_id uuid,
  p_customer_id uuid,
  p_pet_id uuid,
  p_items jsonb,
  p_total numeric,
  p_notes text,
  p_created_by_user_id uuid
)
returns public.invoices
language plpgsql
security invoker
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_invoice_number text;
  v_row public.invoices;
begin
  insert into public.invoice_number_counters (clinic_id, year, next_seq)
  values (p_clinic_id, v_year, 2)
  on conflict (clinic_id, year)
    do update set next_seq = invoice_number_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  v_invoice_number := 'INV-' || v_year || '-' || lpad(v_seq::text, 3, '0');

  insert into public.invoices (
    clinic_id, customer_id, pet_id, invoice_number, items, total, notes, created_by_user_id
  ) values (
    p_clinic_id, p_customer_id, p_pet_id, v_invoice_number, p_items, p_total, p_notes, p_created_by_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;
