create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  sku text,
  category text not null default 'general',
  unit text not null default 'unit',
  quantity_on_hand numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  active boolean not null default true,
  created_by_user_id uuid references auth.users(id),
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_items_quantity_check check (quantity_on_hand >= 0),
  constraint inventory_items_reorder_check check (reorder_level >= 0),
  constraint inventory_items_price_check check (
    (unit_cost is null or unit_cost >= 0) and (unit_price is null or unit_price >= 0)
  ),
  constraint inventory_items_clinic_sku_unique unique (clinic_id, sku)
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type text not null,
  quantity_delta numeric(12,2) not null check (quantity_delta <> 0),
  reason text not null check (char_length(trim(reason)) > 0),
  source_type text not null default 'manual',
  source_id uuid,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint inventory_transactions_type_check
    check (transaction_type in ('adjustment', 'usage', 'restock')),
  constraint inventory_transactions_source_type_check
    check (source_type in ('manual', 'visit', 'vaccination', 'prescription'))
);

create table public.visit_charges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null,
  customer_id uuid not null,
  pet_id uuid not null,
  description text not null check (char_length(trim(description)) > 0),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  status text not null default 'pending',
  invoice_id uuid references public.invoices(id) on delete set null,
  source_type text not null default 'manual',
  source_id uuid,
  created_by_user_id uuid references auth.users(id),
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint visit_charges_visit_clinic_fk
    foreign key (visit_id, clinic_id)
    references public.visits(id, clinic_id) on delete cascade,
  constraint visit_charges_customer_clinic_fk
    foreign key (customer_id, clinic_id)
    references public.customers(id, clinic_id) on delete restrict,
  constraint visit_charges_pet_clinic_fk
    foreign key (pet_id, clinic_id)
    references public.pets(id, clinic_id) on delete restrict,
  constraint visit_charges_status_check
    check (status in ('pending', 'reviewed', 'invoiced', 'void')),
  constraint visit_charges_review_check
    check (
      (status = 'pending' and reviewed_by_user_id is null and reviewed_at is null)
      or (status in ('reviewed', 'invoiced', 'void'))
    )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  recorded_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint payments_method_check check (method in ('cash', 'card', 'bank_transfer', 'bit', 'other'))
);

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

create trigger visit_charges_set_updated_at
  before update on public.visit_charges
  for each row execute function public.set_updated_at();

create index inventory_items_clinic_active_idx
  on public.inventory_items (clinic_id, active, name)
  where deleted_at is null;

create index inventory_transactions_clinic_item_idx
  on public.inventory_transactions (clinic_id, item_id, created_at desc);

create index visit_charges_visit_status_idx
  on public.visit_charges (visit_id, status)
  where deleted_at is null;

create index payments_invoice_idx
  on public.payments (invoice_id, paid_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.visit_charges enable row level security;
alter table public.payments enable row level security;

create policy inventory_items_select_member on public.inventory_items
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy inventory_items_insert_member on public.inventory_items
  for insert to authenticated with check (public.is_clinic_member(clinic_id));
create policy inventory_items_update_member on public.inventory_items
  for update to authenticated using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy inventory_transactions_select_member on public.inventory_transactions
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy inventory_transactions_insert_member on public.inventory_transactions
  for insert to authenticated with check (public.is_clinic_member(clinic_id));

create policy visit_charges_select_member on public.visit_charges
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy visit_charges_insert_member on public.visit_charges
  for insert to authenticated with check (public.is_clinic_member(clinic_id));
create policy visit_charges_update_member on public.visit_charges
  for update to authenticated using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

create policy payments_select_member on public.payments
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy payments_insert_member on public.payments
  for insert to authenticated with check (public.is_clinic_member(clinic_id));
