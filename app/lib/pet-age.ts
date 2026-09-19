/**
 * Formats a pet's age from its birth date, matching the "X ש' Y ח'" style
 * used on the clinic's paper documents. Returns null when there is no birth
 * date to compute from.
 */
export function formatPetAge(birthDate: string | null, now: Date = new Date()): string | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) return "פחות מחודש";
  if (years <= 0) return `${months} ח'`;
  if (months === 0) return `${years} ש'`;
  return `${years} ש' ${months} ח'`;
}
