import { describe, expect, it } from "vitest";
import {
  formatIsraeliPhoneLocal,
  isValidIsraeliPhone,
  normaliseIsraeliPhone,
  toWhatsAppPhone,
} from "../src/phone";

describe("normaliseIsraeliPhone", () => {
  it.each([
    // [input, expected, why this shape shows up]
    ["050-000-0001", "+972500000001", "local mobile with separators"],
    ["0500000001", "+972500000001", "local mobile, no separators"],
    ["054 958 1991", "+972500000001", "local mobile with spaces"],
    ["+972500000001", "+972500000001", "already E.164"],
    ["+972 50-000-0001", "+972500000001", "E.164 with separators"],
    ["972500000001", "+972500000001", "E.164 without the plus"],
    ["+9720500000001", "+972500000001", "country code with a redundant trunk 0"],
    ["500000001", "+972500000001", "leading 0 dropped — forms, spoken input"],
    ["03-1234567", "+97231234567", "landline"],
    ["021234567", "+97221234567", "Jerusalem landline"],
    ["073-2345678", "+972732345678", "VoIP"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseIsraeliPhone(input)).toBe(expected);
  });

  // The regression this module exists for: every one of these used to
  // produce the string "+", which then became a real customers.phone value.
  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["aaaaa", "letters — passes the old z.string().min(5)"],
    ["-----", "separators only"],
    ["unknown", "Twilio's placeholder for a withheld caller id"],
    ["+", "a bare plus"],
  ])("rejects %s (%s)", (input) => {
    expect(normaliseIsraeliPhone(input)).toBeNull();
  });

  it.each([
    ["1234567", "7 digits — a landline with no area code is ambiguous"],
    ["1800123456", "1-800 service number, not an SMS destination"],
    ["*6120", "star short code"],
    ["05000000011", "one digit too many"],
    ["054958199", "one digit too short"],
    ["0141234567", "01 is not an Israeli area or mobile prefix"],
    ["061234567", "06 was retired and is not assignable"],
    ["+14155552671", "a US number — this clinic only serves Israeli callers"],
  ])("rejects %s (%s)", (input) => {
    expect(normaliseIsraeliPhone(input)).toBeNull();
  });

  it("returns null for null and undefined rather than throwing", () => {
    expect(normaliseIsraeliPhone(null)).toBeNull();
    expect(normaliseIsraeliPhone(undefined)).toBeNull();
  });

  it("is idempotent — normalising its own output changes nothing", () => {
    const once = normaliseIsraeliPhone("050-000-0001");
    expect(normaliseIsraeliPhone(once)).toBe(once);
  });

  it("maps every spelling of one number onto a single stored value", () => {
    const spellings = ["050-000-0001", "0500000001", "+972500000001", "972500000001", "500000001"];
    const normalised = new Set(spellings.map((s) => normaliseIsraeliPhone(s)));
    expect(normalised).toEqual(new Set(["+972500000001"]));
  });
});

describe("isValidIsraeliPhone", () => {
  it("accepts a valid number and rejects junk", () => {
    expect(isValidIsraeliPhone("050-000-0001")).toBe(true);
    expect(isValidIsraeliPhone("")).toBe(false);
    expect(isValidIsraeliPhone("aaaaa")).toBe(false);
  });
});

describe("toWhatsAppPhone", () => {
  it("strips the plus for wa.me links", () => {
    expect(toWhatsAppPhone("050-000-0001")).toBe("972500000001");
  });

  it("returns null for a broken number so no link is built", () => {
    expect(toWhatsAppPhone("")).toBeNull();
  });
});

describe("formatIsraeliPhoneLocal", () => {
  it("renders mobile and landline the way Israelis read them", () => {
    expect(formatIsraeliPhoneLocal("+972500000001")).toBe("050-000-0001");
    expect(formatIsraeliPhoneLocal("+97231234567")).toBe("03-123-4567");
  });

  it("passes unrecognised input through so display code needs no null check", () => {
    expect(formatIsraeliPhoneLocal("not a phone")).toBe("not a phone");
    expect(formatIsraeliPhoneLocal(null)).toBe("");
  });
});
