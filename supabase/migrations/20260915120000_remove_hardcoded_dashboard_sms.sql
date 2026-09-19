-- Removes the hardcoded, independently-drifted SQL copy of the reschedule/
-- cancellation SMS wording from appointments_notify_dashboard_change().
-- That wording is now owned entirely by TS (app/lib/services/appointment.service.ts
-- via DashboardNotificationsService.enqueueDashboardChangeNotification), which
-- respects a per-clinic override from clinics.settings.smsTemplates — something
-- SQL had no way to do. The trigger keeps its bookkeeping (skipping stale
-- pending notifications on cancel, patching scheduled_for/time on reschedule),
-- it just no longer creates the reschedule_update/cancellation_update row itself.
CREATE OR REPLACE FUNCTION public.appointments_notify_dashboard_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_morning   timestamptz;
  v_new_followup  timestamptz;
BEGIN
  -- Only fire for dashboard-sourced changes
  IF NEW.changed_via IS DISTINCT FROM 'dashboard' THEN
    RETURN NEW;
  END IF;

  -- ── Cancellation ────────────────────────────────────────────
  IF NEW.status IN ('cancelled', 'late_cancellation')
     AND OLD.status NOT IN ('cancelled', 'late_cancellation', 'completed') THEN

    -- Skip all pending future notifications for this appointment.
    -- The cancellation_update SMS itself is now enqueued from TS.
    UPDATE public.notifications_log
       SET status = 'skipped', updated_at = now()
     WHERE appointment_id = NEW.id AND status = 'pending';

    RETURN NEW;
  END IF;

  -- ── Reschedule (same appointment, new scheduled_at) ─────────
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.status IN ('scheduled', 'confirmed', 'pending_approval') THEN

    -- 08:00 Jerusalem on the appointment day, expressed as UTC (DST-correct).
    -- Step 1: convert scheduled_at to Jerusalem local timestamp (no TZ info).
    -- Step 2: truncate to day → midnight Jerusalem local.
    -- Step 3: add 8 hours → 08:00 Jerusalem local.
    -- Step 4: convert back to UTC via AT TIME ZONE → timestamptz.
    v_new_morning := (
      date_trunc('day', NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem')
      + interval '8 hours'
    ) AT TIME ZONE 'Asia/Jerusalem';

    v_new_followup := NEW.scheduled_at
                       + make_interval(mins => NEW.duration_minutes)
                       + interval '24 hours';

    -- Update morning_reminder: new scheduled_for + patch time in body
    UPDATE public.notifications_log
       SET scheduled_for = v_new_morning,
           body          = regexp_replace(
                             body,
                             '🕒 \d{2}:\d{2}',
                             '🕒 ' || to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')
                           ),
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'morning_reminder'
       AND status = 'pending';

    -- Update post_visit_followup: new scheduled_for only
    UPDATE public.notifications_log
       SET scheduled_for = v_new_followup,
           updated_at    = now()
     WHERE appointment_id = NEW.id
       AND type = 'post_visit_followup'
       AND status = 'pending';

    -- reschedule_update SMS itself is now enqueued from TS, not here.
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.appointments_notify_dashboard_change() IS
  'Bookkeeping-only trigger for changed_via=dashboard appointment updates: skips '
  'stale pending notifications on cancel, patches scheduled_for/time on reschedule. '
  'Does NOT create the reschedule_update/cancellation_update SMS row itself — that '
  'moved to app/lib/services/appointment.service.ts (via DashboardNotificationsService), '
  'so it can respect a per-clinic wording override from clinics.settings.smsTemplates.';
