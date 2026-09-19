import { describe, expect, it } from "vitest";
import { formatPetAge } from "@/lib/pet-age";

describe("formatPetAge", () => {
  it("returns null when birthDate is null", () => {
    expect(formatPetAge(null, new Date("2026-09-07"))).toBeNull();
  });

  it("formats whole years and remaining months", () => {
    // Born 2023-08-07: exactly 3 years and 1 month before 2026-09-07.
    expect(formatPetAge("2023-08-07", new Date("2026-09-07"))).toBe("3 ש' 1 ח'");
  });

  it("formats less than a year as months only", () => {
    // Born 2026-06-07: 3 months before 2026-09-07.
    expect(formatPetAge("2026-06-07", new Date("2026-09-07"))).toBe("3 ח'");
  });

  it("formats a birth date in the current month as under a month old", () => {
    expect(formatPetAge("2026-09-01", new Date("2026-09-07"))).toBe("פחות מחודש");
  });

  it("formats whole years with no remaining months without a trailing 0 ח'", () => {
    expect(formatPetAge("2023-09-07", new Date("2026-09-07"))).toBe("3 ש'");
  });
});
