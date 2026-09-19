-- Tenant-safe invoice references + atomic visit→invoice conversion.
-- payments.invoice_id previously referenced invoices(id) without clinic_id,
-- so a payment row could point at another clinic's invoice. visit_charges
-- had the same loose FK. createInvoiceFromVisit created the invoice then
-- marked charges invoiced in a second statement, allowing double invoices.

alter table public.invoices
  add constraint invoices_id_clinic_unique unique (id, clinic_id);

alter table public.payments
  drop constraint if exists payments_invoice_id_fkey;

alter table public.payments
  add constraint payments_invoice_clinic_fk
  foreign key (invoice_id, clinic_id)
  references public.invoices (id, clinic_id)
  on delete restrict;

alter table public.visit_charges
  drop constraint if exists visit_charges_invoice_id_fkey;

alter table public.visit_charges
  add constraint visit_charges_invoice_clinic_fk
  foreign key (invoice_id, clinic_id)
  references public.invoices (id, clinic_id)
  on delete set null;

create or replace function public.create_invoice_from_visit(
  p_visit_id uuid,
  p_notes text,
  p_created_by_user_id uuid
)
returns public.invoices
language plpgsql
security invoker
as $$
declare
  v_visit public.visits;
  v_pending int;
  v_items jsonb;
  v_total numeric;
  v_invoice public.invoices;
  v_updated int;
begin
  select * into v_visit
  from public.visits
  where id = p_visit_id
    and deleted_at is null;

  if not found then
    raise exception 'visit not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.visit_charges
  where visit_id = p_visit_id
    and deleted_at is null
  for update;

  select count(*) into v_pending
  from public.visit_charges
  where visit_id = p_visit_id
    and deleted_at is null
    and status = 'pending';

  if v_pending > 0 then
    raise exception 'pending charges remain' using errcode = 'P0001';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'description', description,
          'quantity', quantity,
          'unitPrice', unit_price
        )
        order by created_at
      ),
      '[]'::jsonb
    ),
    coalesce(round(sum(quantity * unit_price)::numeric, 2), 0)
  into v_items, v_total
  from public.visit_charges
  where visit_id = p_visit_id
    and deleted_at is null
    and status = 'reviewed';

  if v_items = '[]'::jsonb then
    raise exception 'no reviewed charges' using errcode = 'P0001';
  end if;

  v_invoice := public.create_invoice(
    v_visit.clinic_id,
    v_visit.customer_id,
    v_visit.pet_id,
    v_items,
    v_total,
    p_notes,
    p_created_by_user_id
  );

  update public.visit_charges
  set
    status = 'invoiced',
    invoice_id = v_invoice.id,
    version = version + 1
  where visit_id = p_visit_id
    and deleted_at is null
    and status = 'reviewed';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'failed to mark charges invoiced' using errcode = 'P0001';
  end if;

  return v_invoice;
end;
$$;
