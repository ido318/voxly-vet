-- Atomic view_count increment for public visit-share links (concurrent views).
create or replace function public.increment_visit_share_view(p_share_id uuid)
returns void
language sql
as $$
  update public.visit_shares
     set view_count = view_count + 1,
         last_viewed_at = now()
   where id = p_share_id;
$$;

comment on function public.increment_visit_share_view(uuid) is
  'Atomically increments visit_shares.view_count and stamps last_viewed_at.';
