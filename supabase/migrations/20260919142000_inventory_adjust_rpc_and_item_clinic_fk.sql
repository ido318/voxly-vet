-- Atomic inventory adjustment (M6) + composite FK so transactions cannot
-- reference an item from another clinic (M7). Payments/visit_charges FKs
-- were already tightened in 20260918121000.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_id_clinic_unique'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_id_clinic_unique unique (id, clinic_id);
  end if;
end $$;

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_item_id_fkey;

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_item_clinic_fk;

alter table public.inventory_transactions
  add constraint inventory_transactions_item_clinic_fk
  foreign key (item_id, clinic_id)
  references public.inventory_items (id, clinic_id)
  on delete restrict;

create or replace function public.adjust_inventory_item(
  p_item_id uuid,
  p_clinic_id uuid,
  p_quantity_delta numeric,
  p_reason text,
  p_transaction_type text default 'adjustment',
  p_source_type text default 'manual',
  p_source_id uuid default null,
  p_created_by_user_id uuid default null
)
returns public.inventory_items
language plpgsql
security invoker
as $$
declare
  v_item public.inventory_items;
begin
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'quantity delta must not be zero' using errcode = 'P0001';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason is required' using errcode = 'P0001';
  end if;

  update public.inventory_items
  set
    quantity_on_hand = quantity_on_hand + p_quantity_delta,
    version = version + 1
  where id = p_item_id
    and clinic_id = p_clinic_id
    and deleted_at is null
    and quantity_on_hand + p_quantity_delta >= 0
  returning * into v_item;

  if not found then
    if exists (
      select 1
      from public.inventory_items
      where id = p_item_id
        and clinic_id = p_clinic_id
        and deleted_at is null
    ) then
      raise exception 'inventory adjustment cannot make stock negative' using errcode = 'P0001';
    end if;
    raise exception 'inventory item not found' using errcode = 'P0002';
  end if;

  insert into public.inventory_transactions (
    clinic_id,
    item_id,
    transaction_type,
    quantity_delta,
    reason,
    source_type,
    source_id,
    created_by_user_id
  ) values (
    p_clinic_id,
    p_item_id,
    coalesce(p_transaction_type, 'adjustment'),
    p_quantity_delta,
    trim(p_reason),
    coalesce(p_source_type, 'manual'),
    p_source_id,
    p_created_by_user_id
  );

  return v_item;
end;
$$;

grant execute on function public.adjust_inventory_item(
  uuid, uuid, numeric, text, text, text, uuid, uuid
) to authenticated;
