-- Separate "what Dana bills" from "what Tomer may say on the phone".
--
-- Neutering costs 350 ₪, and that number is real — Dana charges by it. What is
-- not true is that Tomer can quote it before the visit: the price depends on
-- species, weight, age and medical state, so Dana gives it herself. That is a
-- binding decision (CLAUDE.md) and the frozen SMS wording says
-- 'המחיר יימסר על ידי ד"ר דנה'.
--
-- Until now the two were reconciled by keeping a second, hardcoded price map
-- in each workspace, where neutering was simply absent. That encoded the
-- outcome but lost the reason — and "there is no price" and "there is a price
-- nobody may read out" are different things. The first one lies.
--
-- So the row keeps its price and carries the reason instead.
alter table public.price_list_items
  add column if not exists agent_quotable boolean not null default true;

comment on column public.price_list_items.agent_quotable is
  'False when Tomer must not name this price before the visit, because it depends on the individual animal. Billing still uses default_price; the pre-visit SMS says המחיר יימסר על ידי ד"ר דנה instead.';

update public.price_list_items
set agent_quotable = false
where visit_type = 'neutering';
