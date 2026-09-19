/** Normalize phone for comparison (digits + optional leading +). */
export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  return hasPlus ? `+${digits}` : digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhoneNumber(a);
  const nb = normalizePhoneNumber(b);
  if (na === nb) return true;
  const da = na.replace(/\D/g, "");
  const db = nb.replace(/\D/g, "");
  if (da === db) return true;
  if (da.length >= 9 && db.length >= 9) {
    return da.slice(-9) === db.slice(-9);
  }
  return false;
}
