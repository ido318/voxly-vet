-- Let the processor tell "crashed before sending" from "crashed after sending".
--
-- The send path is: claim the row (status='processing') -> sendSms -> mark
-- 'sent' with the Twilio sid. If the process dies between the send and that
-- last UPDATE, the row sits in 'processing' and the 5-minute recovery sweep
-- resets it to 'pending' — so the next run texts the client a second time.
-- The code acknowledged this in a comment and logged it; nothing prevented it.
--
-- Twilio's Messages API has no idempotency key, so there is no way to make the
-- retry a no-op at the provider. What we can do is record the attempt before
-- making it. A stale 'processing' row with send_attempted_at set may already
-- have reached the client, so recovery must not resend it blindly; one row a
-- human looks at beats a duplicate reminder to a client.

alter table public.notifications_log
  add column if not exists send_attempted_at timestamptz;

comment on column public.notifications_log.send_attempted_at is
  'Set immediately before handing the row to Twilio. Its presence on a stale processing row means the SMS may already have been delivered, so the recovery sweep closes the row for review instead of retrying it.';

-- The recovery sweep reads exactly this shape.
create index if not exists notifications_log_processing_stale_idx
  on public.notifications_log (status, updated_at)
  where status = 'processing';
