-- Add 'arrival_reminder' — an SMS sent ~2 hours before a visit to confirm arrival.
alter table public.notifications_log drop constraint if exists notifications_log_type_check;

alter table public.notifications_log add constraint notifications_log_type_check
  check (type = any (array[
    'booking_confirmation'::text,
    'morning_reminder'::text,
    'post_visit_followup'::text,
    'reschedule_update'::text,
    'cancellation_update'::text,
    'client_cancellation_confirmation'::text,
    'arrival_reminder'::text
  ]));
