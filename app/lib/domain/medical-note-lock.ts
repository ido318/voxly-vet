/**
 * Single source of truth for the medical note 24-hour edit lock.
 *
 * This MUST mirror the exact condition enforced by the `medical_notes`
 * BEFORE UPDATE trigger added in
 * supabase/migrations/20260901172952_medical_notes_lock_and_addendum.sql:
 *
 *   OLD.status = 'approved'
 *   AND OLD.created_at <= now() - interval '24 hours'
 *
 * which is equivalent to: status is 'approved' AND at least
 * MEDICAL_NOTE_LOCK_HOURS have elapsed since createdAt (inclusive of the
 * boundary — exactly 24h00m0s counts as locked).
 *
 * The app-level check here is defense-in-depth ABOVE the trigger (so users
 * get a clear Hebrew error before ever reaching the DB), never a substitute
 * for it — the trigger remains the authoritative enforcement layer. If this
 * function and the trigger ever disagree, treat it as a bug: fix whichever
 * side drifted so they match again.
 */

export const MEDICAL_NOTE_LOCK_HOURS = 24;

const MEDICAL_NOTE_LOCK_MS = MEDICAL_NOTE_LOCK_HOURS * 60 * 60 * 1000;

export function isMedicalNoteLocked(
  note: { status: string; createdAt: string | Date },
  now: Date = new Date(),
): boolean {
  if (note.status !== "approved") return false;

  const createdAt = note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
  const elapsedMs = now.getTime() - createdAt.getTime();

  return elapsedMs >= MEDICAL_NOTE_LOCK_MS;
}
