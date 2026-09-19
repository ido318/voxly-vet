-- Treat pending approval appointments as active calendar blockers.
-- Neutering bookings created by Tomer are pending_approval until Dana approves,
-- but they must still reserve their calendar slot.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_active_overlap;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_active_overlap
  EXCLUDE USING gist (
    clinic_id WITH =,
    tstzrange(scheduled_at, end_at, '[)') WITH &&
  )
  WHERE (
    deleted_at IS NULL
    AND status IN ('scheduled', 'confirmed', 'pending_approval')
  );
