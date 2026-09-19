-- Code review of 20260828000030 caught a real gap: notifications_log_vaccination_type_unique
-- (UNIQUE(vaccination_id, type)) provides no idempotency guarantee on its own, since Postgres
-- treats every NULL as distinct in a unique constraint -- a caller could insert unlimited
-- 'vaccination_reminder' rows with vaccination_id left NULL and silently bypass dedup.
-- Make the constraint load-bearing: a vaccination_reminder row MUST carry a vaccination_id.

alter table public.notifications_log add constraint notifications_log_vaccination_id_required
  check (type <> 'vaccination_reminder' or vaccination_id is not null);
