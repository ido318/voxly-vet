-- Migration: add 'processing' to notifications_log status constraint
-- Required for atomic claim pattern (pending → processing → sent|failed).
-- Also re-applies the partial index to cover processing rows for recovery queries.

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS notifications_log_status_check;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT notifications_log_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'));
