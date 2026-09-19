// Israeli phone numbers — the single source of truth for both workspaces.
//
// Until 2026-09 there were four independent implementations: normalisePhone
// (agent/src/lib/store.ts), toE164Israel (app/lib/integrations/twilio/sms.ts),
// normalizePhoneNumber/phonesMatch (app/lib/integrations/twilio/phone.ts) and
// waPhone (app/components/dashboard/send-message-modal.tsx). The first two
// were near-copies that both ended with `return "+" + digits`, so any input
// with no usable digits — "", "unknown", "aaaaa" — normalised to the string
// "+".
//
// That was not theoretical. A call with an empty caller id created a real
// customer row with phone = "+", and because createOrFindCustomer looks the
// number up before inserting, every later junk call *reused that same row* —
// merging unrelated callers into one card. Nine SMS to it failed at Twilio
// with "Invalid 'To' Phone Number".
//
// So the contract here is deliberately different from the functions it
// replaces: an unusable number returns null rather than a plausible-looking
// string. Callers must decide what to do with null; they can no longer store
// it by accident.
//
// Deliberately dependency-free (the package has no runtime deps). Each
// workspace wraps isValidIsraeliPhone in its own zod schema.

/** `+972` — Israel's country calling code, as it appears in E.164. */
export const ISRAEL_COUNTRY_CODE = "+972";

// National significant number: what follows +972, i.e. the local number with
// its leading 0 removed. Three shapes are reachable by SMS or a callback:
//
//   mobile    5X XXXXXXX   9 digits, 05X locally  (050–059)
//   VoIP      7X XXXXXXX   9 digits, 07X locally  (072–079)
//   landline  N XXXXXXX    8 digits, 0N locally   (02,03,04,08,09)
//
// Everything else is rejected on purpose, including 1-800 / 1-700 service
// numbers and *NNNN short codes: they are not valid SMS destinations and not
// a number Dana can call a client back on.
const MOBILE_OR_VOIP_NSN = /^[57][0-9]{8}$/;
const LANDLINE_NSN = /^[23489][0-9]{7}$/;

function isValidNsn(nsn: string): boolean {
  return MOBILE_OR_VOIP_NSN.test(nsn) || LANDLINE_NSN.test(nsn);
}

/**
 * Reduce any Israeli phone number to its national significant number, or null
 * if it cannot be one.
 *
 * Accepts the shapes people and upstream systems actually send:
 *   "050-000-0001"    → "500000001"   (local, with separators)
 *   "+972 50 0000001" → "500000001"   (E.164, with separators)
 *   "972500000001"    → "500000001"   (E.164 without the +)
 *   "500000001"       → "500000001"   (leading 0 dropped — common in forms
 *                                      and spoken back by the agent)
 *   "03-1234567"      → "31234567"    (landline)
 */
function toNsn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Country code, with or without the +. Guarded by the length check so a
  // local number that merely starts with 972 (there is none today, but the
  // prefix space is not frozen) cannot be misread as a country code.
  if (digits.startsWith("972") && digits.length > 9) {
    const rest = digits.slice(3);
    // "+9720500000001" — some systems keep the trunk 0 after the country
    // code. It is redundant in E.164 but common enough to accept.
    return isValidNsn(rest) ? rest : stripTrunkZero(rest);
  }

  if (digits.startsWith("0")) return stripTrunkZero(digits);

  // No prefix at all: only trustworthy when the number already looks like a
  // complete NSN. A bare 7-digit landline has no area code and is ambiguous,
  // so it is rejected rather than guessed at.
  return isValidNsn(digits) ? digits : null;
}

function stripTrunkZero(value: string): string | null {
  if (!value.startsWith("0")) return null;
  const nsn = value.slice(1);
  return isValidNsn(nsn) ? nsn : null;
}

/**
 * Normalise an Israeli phone number to E.164 (`+972…`), or return null when
 * the input cannot be one.
 *
 * Null means "do not store this and do not text it" — it is never a number.
 * Callers that used to get "+" back for junk input now get null and must
 * handle it explicitly.
 */
export function normaliseIsraeliPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const nsn = toNsn(raw);
  return nsn ? `${ISRAEL_COUNTRY_CODE}${nsn}` : null;
}

/** True when the input normalises to a valid Israeli E.164 number. */
export function isValidIsraeliPhone(raw: string | null | undefined): boolean {
  return normaliseIsraeliPhone(raw) !== null;
}

/**
 * The digits WhatsApp's wa.me links expect: E.164 with no leading "+".
 * Returns null for the same inputs normaliseIsraeliPhone rejects, so a
 * broken number produces no link rather than a link to nowhere.
 */
export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  const e164 = normaliseIsraeliPhone(raw);
  return e164 ? e164.slice(1) : null;
}

/**
 * Format an E.164 Israeli number the way Israelis read it: "+972500000001"
 * → "050-000-0001". Falls back to the input unchanged when it is not a
 * number we recognise, so display code never has to null-check.
 */
export function formatIsraeliPhoneLocal(raw: string | null | undefined): string {
  const nsn = typeof raw === "string" ? toNsn(raw) : null;
  if (!nsn) return typeof raw === "string" ? raw : "";

  if (nsn.length === 9) {
    // 5X XXX XXXX → 05X-XXX-XXXX
    return `0${nsn.slice(0, 2)}-${nsn.slice(2, 5)}-${nsn.slice(5)}`;
  }
  // N XXX XXXX → 0N-XXX-XXXX
  return `0${nsn.slice(0, 1)}-${nsn.slice(1, 4)}-${nsn.slice(4)}`;
}
