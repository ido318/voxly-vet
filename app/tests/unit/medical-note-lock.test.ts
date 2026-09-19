import { describe, expect, it } from "vitest";
import { MEDICAL_NOTE_LOCK_HOURS, isMedicalNoteLocked } from "@/lib/domain/medical-note-lock";

const APPROVED_AT = new Date("2026-08-31T00:00:00.000Z");

function hoursLater(hours: number): Date {
  return new Date(APPROVED_AT.getTime() + hours * 60 * 60 * 1000);
}

describe("isMedicalNoteLocked", () => {
  it("exposes a 24-hour lock threshold", () => {
    expect(MEDICAL_NOTE_LOCK_HOURS).toBe(24);
  });

  it("is never locked while status is draft, regardless of age", () => {
    const veryOld = hoursLater(24 * 365); // a full year later
    expect(
      isMedicalNoteLocked({ status: "draft", createdAt: APPROVED_AT }, veryOld),
    ).toBe(false);
  });

  it("is never locked while status is archived, regardless of age", () => {
    const veryOld = hoursLater(24 * 365);
    expect(
      isMedicalNoteLocked({ status: "archived", createdAt: APPROVED_AT }, veryOld),
    ).toBe(false);
  });

  it("is unlocked when approved and 23h59m have elapsed", () => {
    const now = hoursLater(23 + 59 / 60);
    expect(
      isMedicalNoteLocked({ status: "approved", createdAt: APPROVED_AT }, now),
    ).toBe(false);
  });

  it("is locked at exactly the 24-hour boundary (matches the DB trigger's <= now() - interval '24 hours')", () => {
    const now = hoursLater(24);
    expect(
      isMedicalNoteLocked({ status: "approved", createdAt: APPROVED_AT }, now),
    ).toBe(true);
  });

  it("is locked when approved and 24h01m have elapsed", () => {
    const now = hoursLater(24 + 1 / 60);
    expect(
      isMedicalNoteLocked({ status: "approved", createdAt: APPROVED_AT }, now),
    ).toBe(true);
  });

  it("accepts a string createdAt the same way as a Date", () => {
    const now = hoursLater(25);
    expect(
      isMedicalNoteLocked(
        { status: "approved", createdAt: APPROVED_AT.toISOString() },
        now,
      ),
    ).toBe(true);
  });

  it("defaults `now` to the current time when omitted", () => {
    const longAgo = { status: "approved", createdAt: "2020-01-01T00:00:00.000Z" };
    expect(isMedicalNoteLocked(longAgo)).toBe(true);
  });
});
