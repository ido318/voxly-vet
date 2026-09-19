import { AppError } from "@/lib/errors/app-error";

/**
 * Verifies that a private-bucket storagePath (`{clinic_id}/{visit_id}/{uuid}.ext`)
 * matches the visit actually being operated on.
 *
 * Routes that read/download from an admin-bypasses-RLS bucket (e.g.
 * soap-recordings) must call this before any Storage access — it's the
 * only thing preventing a caller from reading, downloading, or attaching
 * a recording that belongs to a different visit, possibly in a different
 * clinic they also happen to have access to. Checking `actor.clinicIds`
 * membership alone is not enough for a multi-clinic actor: the segments
 * must match THIS visit exactly.
 *
 * Handles malformed storagePath values (empty string, no "/", an empty
 * segment) gracefully — none of these can equal the expected clinicId/
 * visitId, so they're rejected the same way a genuine mismatch is, never
 * with an unhandled exception.
 *
 * @throws {AppError} a 403 forbidden error when the segments don't match.
 */
export function assertStoragePathMatchesVisit(
  storagePath: string,
  clinicId: string,
  visitId: string,
): void {
  const [clinicSegment, visitSegment] = storagePath.split("/");
  if (clinicSegment !== clinicId || visitSegment !== visitId) {
    throw AppError.forbidden("Cannot access recording outside this visit");
  }
}
