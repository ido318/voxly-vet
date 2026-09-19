import type { MedicalNote } from "@/types/domain/medical-note";

/**
 * Picks the note to source a visit's SOAP fields from: the most recent
 * approved note, falling back to the most recent note of any status. Input
 * may be in any order. Returns null when there are no notes at all.
 */
export function selectVisitMedicalNote(notes: MedicalNote[]): MedicalNote | null {
  if (notes.length === 0) return null;

  const byNewestFirst = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const newestApproved = byNewestFirst.find((n) => n.status === "approved");
  // byNewestFirst is provably non-empty: guaranteed by the early `notes.length === 0` return above
  return newestApproved ?? byNewestFirst[0]!;
}
