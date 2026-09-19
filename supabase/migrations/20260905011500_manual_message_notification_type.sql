-- Manual messages sent by clinic staff from the client card.
--
-- Until now every notifications_log row was machine-generated, and the dashboard
-- offered no way to message a client at all: the client card linked to sms: and
-- wa.me, which only hand off to whatever app the staff member's device happens to
-- have. Recording staff-sent messages in the same table keeps one delivery
-- history per client rather than splitting it across personal phones.

alter table public.notifications_log drop constraint if exists notifications_log_type_check;

alter table public.notifications_log add constraint notifications_log_type_check
  check (type = any (array[
    'booking_confirmation'::text,
    'morning_reminder'::text,
    'post_visit_followup'::text,
    'reschedule_update'::text,
    'cancellation_update'::text,
    'client_cancellation_confirmation'::text,
    'arrival_reminder'::text,
    'vaccination_reminder'::text,
    'manual_message'::text
  ]));

-- A manual message carries no appointment_id or vaccination_id, so neither
-- unique constraint applies to it (Postgres treats NULLs as distinct) and staff
-- can send more than one message to the same client.
