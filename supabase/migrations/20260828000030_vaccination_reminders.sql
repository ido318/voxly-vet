-- supabase/migrations/20260828000030_vaccination_reminders.sql
-- Vaccination reminder SMS: notifications_log currently only supports
-- appointment-attached notifications. A vaccination reminder has no
-- appointment yet -- that's the point, it's inviting the customer to book
-- one. Add a nullable vaccination_id + its own idempotency constraint,
-- independent of the existing appointment_id one.

alter table public.notifications_log
  add column if not exists vaccination_id uuid references public.vaccinations(id) on delete set null;

alter table public.notifications_log
  add constraint notifications_log_vaccination_type_unique unique (vaccination_id, type);

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
    'vaccination_reminder'::text
  ]));
