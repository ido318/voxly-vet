-- Free-text customer tags (e.g. "VIP", "רגיש להרדמה") — no fixed taxonomy,
-- staff choose the wording per customer. A plain text[] rather than a
-- separate tags table: low cardinality per customer, no cross-clinic
-- sharing needed, and this keeps read/write on the existing customers
-- row instead of adding a join for every list view.
alter table public.customers
  add column tags text[] not null default '{}';

comment on column public.customers.tags is
  'Free-text labels staff attach to a customer (e.g. VIP, anesthesia-sensitive). No fixed taxonomy.';

-- Speeds up "customers with tag X" lookups without needing a join table.
create index customers_tags_idx on public.customers using gin (tags);
