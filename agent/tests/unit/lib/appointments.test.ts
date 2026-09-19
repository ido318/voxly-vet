import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getClinicHours,
  getDayNameHe,
  generateSlotsForVisitType,
  formatSlotLabel,
  formatSlotSpokenHe,
  formatSlotOptionForTool,
  formatDateHe,
  isWithin14Days,
  bookingWindowRejection,
  isTooLateToCancel,
  effectiveDuration,
  VISIT_TYPE_CONFIG,
  toIso,
} from "../../../src/lib/appointments.js";

// Reference dates (verified):
// 2026-06-14 = Sunday
// 2026-06-19 = Friday
// 2026-06-20 = Saturday
// 2026-06-18 = Thursday

describe("getClinicHours", () => {
  it("ראשון (14/6/2026) → 08:00-20:00", () => {
    const h = getClinicHours("2026-06-14");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 0 });
    expect(h!.end).toEqual({ h: 20, m: 0 });
  });

  it("חמישי (18/6/2026) → 08:00-20:00", () => {
    const h = getClinicHours("2026-06-18");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 0 });
    expect(h!.end).toEqual({ h: 20, m: 0 });
  });

  it("שישי (19/6/2026) → 08:30-13:00", () => {
    const h = getClinicHours("2026-06-19");
    expect(h).not.toBeNull();
    expect(h!.start).toEqual({ h: 8, m: 30 });
    expect(h!.end).toEqual({ h: 13, m: 0 });
  });

  it("שבת (20/6/2026) → null (סגור)", () => {
    expect(getClinicHours("2026-06-20")).toBeNull();
  });
});

describe("getDayNameHe", () => {
  it("2026-06-14 (Sunday) → ראשון", () => {
    expect(getDayNameHe("2026-06-14")).toBe("ראשון");
  });

  it("2026-06-19 (Friday) → שישי", () => {
    expect(getDayNameHe("2026-06-19")).toBe("שישי");
  });

  it("2026-06-20 (Saturday) → שבת", () => {
    expect(getDayNameHe("2026-06-20")).toBe("שבת");
  });
});

describe("formatDateHe", () => {
  it("2026-06-15 → 15/06/2026", () => {
    expect(formatDateHe("2026-06-15")).toBe("15/06/2026");
  });
});

describe("formatSlotOptionForTool", () => {
  it("כולל שעה קריאה בפורמט ישראלי טבעי (לא 24 שעות) וגם scheduled_at מדויק עם timezone ישראל", () => {
    expect(formatSlotOptionForTool("2026-06-14T11:30:00+03:00")).toBe(
      "11:30 בבוקר (scheduled_at=2026-06-14T11:30:00+03:00)",
    );
  });
});

describe("formatSlotSpokenHe", () => {
  it("ממיר שעות אחר-הצהריים/ערב לפורמט 12 שעות טבעי במקום 24 שעות (regression: לא עוד 'שלוש עשרה')", () => {
    expect(formatSlotSpokenHe("2026-08-20T13:00:00+03:00")).toBe("1:00 בצהריים");
    expect(formatSlotSpokenHe("2026-08-20T14:30:00+03:00")).toBe("2:30 אחר הצהריים");
    expect(formatSlotSpokenHe("2026-08-20T18:15:00+03:00")).toBe("6:15 בערב");
  });

  it("שעות בוקר וצהריים מדויקות", () => {
    expect(formatSlotSpokenHe("2026-08-20T08:00:00+03:00")).toBe("8:00 בבוקר");
    expect(formatSlotSpokenHe("2026-08-20T12:00:00+03:00")).toBe("12:00 בצהריים");
  });

  it("ממיר נכון גם כשה-ISO חוזר מה-DB ב-UTC", () => {
    // 11:00Z בקיץ (+03:00) = 14:00 ישראל = "2:00 אחר הצהריים"
    expect(formatSlotSpokenHe("2026-08-20T11:00:00.000Z")).toBe("2:00 אחר הצהריים");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visit type config
// ─────────────────────────────────────────────────────────────────────────────

describe("VISIT_TYPE_CONFIG", () => {
  it("checkup: 30+10=40 effective, no approval", () => {
    expect(effectiveDuration("checkup")).toBe(40);
    expect(VISIT_TYPE_CONFIG.checkup.requiresApproval).toBe(false);
  });

  it("home_visit: 60+30=90 effective, no approval", () => {
    expect(effectiveDuration("home_visit")).toBe(90);
    expect(VISIT_TYPE_CONFIG.home_visit.requiresApproval).toBe(false);
  });

  it("vaccination: 20+10=30 effective, no approval", () => {
    expect(effectiveDuration("vaccination")).toBe(30);
    expect(VISIT_TYPE_CONFIG.vaccination.requiresApproval).toBe(false);
  });

  it("phone_consultation: 20+0=20 effective, no approval", () => {
    expect(effectiveDuration("phone_consultation")).toBe(20);
    expect(VISIT_TYPE_CONFIG.phone_consultation.requiresApproval).toBe(false);
  });

  it("neutering: 30+10=40 effective, requires approval", () => {
    expect(effectiveDuration("neutering")).toBe(40);
    expect(VISIT_TYPE_CONFIG.neutering.requiresApproval).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSlotsForVisitType
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAY_HOURS = { start: { h: 8, m: 0 }, end: { h: 20, m: 0 } };
const FRIDAY_HOURS  = { start: { h: 8, m: 30 }, end: { h: 13, m: 0 } };

describe("generateSlotsForVisitType — checkup (effective 40 min)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ללא תורים תפוסים — מחזיר את כל ה-slots הפנויים", () => {
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", []);
    expect(slots.length).toBe(69);
    expect(formatSlotLabel(slots[0]!)).toBe("08:00");
    expect(formatSlotLabel(slots.at(-1)!)).toBe("19:20");
  });

  it("formatSlotLabel — ממיר נכון גם כשה-ISO חוזר מה-DB ב-UTC (regression: לא string slice נאיבי)", () => {
    // Supabase/PostgREST מחזיר timestamptz מנורמל ל-UTC אחרי insert/select,
    // גם אם הקוד שלח +03:00 במקור. 11:30 בישראל (קיץ, +03:00) = 08:30Z.
    expect(formatSlotLabel("2026-08-20T08:30:00.000Z")).toBe("11:30");
    expect(formatSlotLabel("2026-08-20T08:30:00+00:00")).toBe("11:30");
    // חורף (+02:00): 10:00 בישראל = 08:00Z.
    expect(formatSlotLabel("2026-01-15T08:00:00.000Z")).toBe("10:00");
    // מחרוזת שכבר ב-offset ישראלי מוצגת ללא שינוי.
    expect(formatSlotLabel("2026-08-20T11:30:00+03:00")).toBe("11:30");
  });

  it("מציג כל חלון פנוי בקפיצות של 10 דקות", () => {
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", []);
    expect(slots.map(formatSlotLabel).slice(0, 8)).toEqual([
      "08:00",
      "08:10",
      "08:20",
      "08:30",
      "08:40",
      "08:50",
      "09:00",
      "09:10",
    ]);
  });

  it("להיום — לא מציע שעות שכבר עברו", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T06:05:00Z")); // 09:05 Asia/Jerusalem
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", []);
    expect(formatSlotLabel(slots[0]!)).toBe("09:10");
  });

  it("slot ראשון תפוס — מחזיר מ-08:30", () => {
    // Block 08:00-08:30
    const booked = [{ start: "2026-06-14T08:00:00+03:00", end: "2026-06-14T08:30:00+03:00" }];
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", booked);
    expect(formatSlotLabel(slots[0]!)).toBe("08:30");
  });

  it("חסימה חלקית משאירה את שעות הבוקר פנויות", () => {
    const booked = [{ start: "2026-06-14T12:00:00+03:00", end: "2026-06-14T20:00:00+03:00" }];
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", booked);
    const labels = slots.map(formatSlotLabel);
    expect(labels[0]).toBe("08:00");
    expect(labels.at(-1)).toBe("11:20");
    expect(labels).not.toContain("12:00");
  });

  it("לא מציע slot שסיומו לאחר סגירת המרפאה", () => {
    // Latest checkup (40 min eff) can start at 19:20 (ends 20:00)
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", []);
    const labels = slots.map(formatSlotLabel);
    expect(labels.every((l) => l <= "19:20")).toBe(true);
  });
});

describe("generateSlotsForVisitType — home_visit (effective 90 min)", () => {
  it("latest start = 18:30 (90 min before 20:00)", () => {
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "home_visit", []);
    const labels = slots.map(formatSlotLabel);
    expect(labels.every((l) => l <= "18:30")).toBe(true);
  });
});

describe("generateSlotsForVisitType — שישי (08:30-13:00) + vaccination (30 min eff)", () => {
  it("מתחיל ב-08:30 ומסיים לא לאחר 12:30", () => {
    const slots = generateSlotsForVisitType("2026-06-26", FRIDAY_HOURS, "vaccination", []);
    expect(slots.length).toBeGreaterThan(0);
    expect(formatSlotLabel(slots[0]!)).toBe("08:30");
    const labels = slots.map(formatSlotLabel);
    expect(labels.every((l) => l <= "12:30")).toBe(true);
  });
});

describe("generateSlotsForVisitType — כל השעות תפוסות", () => {
  it("מחזיר [] כשאין מקום", () => {
    // Block the entire day
    const booked = [{ start: "2026-06-14T00:00:00+03:00", end: "2026-06-14T23:59:59+03:00" }];
    const slots = generateSlotsForVisitType("2026-06-14", WEEKDAY_HOURS, "checkup", booked);
    expect(slots).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isWithin14Days
// ─────────────────────────────────────────────────────────────────────────────

describe("isWithin14Days", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("היום → true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(isWithin14Days("2026-06-11")).toBe(true);
  });

  it("14 ימים קדימה בדיוק → true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(isWithin14Days("2026-06-25")).toBe(true);
  });

  it("15 ימים קדימה → false", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(isWithin14Days("2026-06-26")).toBe(false);
  });

  it("אתמול → false", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(isWithin14Days("2026-06-10")).toBe(false);
  });
});

describe("bookingWindowRejection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects Saturday even inside the 14-day window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(bookingWindowRejection("2026-06-20T10:00:00+03:00", "checkup")).toContain("סגורה בשבת");
  });

  it("rejects a date more than 14 days ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(bookingWindowRejection("2026-06-26T10:00:00+03:00", "checkup")).toContain("14 יום");
  });

  it("rejects a weekday slot after clinic close", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(bookingWindowRejection("2026-06-14T20:00:00+03:00", "checkup")).toContain("שעות הפעילות");
  });

  it("allows a weekday in-hours slot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    expect(bookingWindowRejection("2026-06-14T10:00:00+03:00", "checkup")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Israel timezone / DST
// ─────────────────────────────────────────────────────────────────────────────

describe("Israel timezone", () => {
  it("uses +03:00 during Israeli daylight saving time", () => {
    expect(toIso("2026-06-14", 8, 0)).toBe("2026-06-14T08:00:00+03:00");
  });

  it("uses +02:00 during Israeli winter time", () => {
    expect(toIso("2026-01-15", 8, 0)).toBe("2026-01-15T08:00:00+02:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isTooLateToCancel — 4-hour rule
// ─────────────────────────────────────────────────────────────────────────────

describe("isTooLateToCancel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("5 שעות לפני → false (מותר לבטל)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00Z")); // 08:00 UTC
    const appt = "2026-06-14T13:00:00Z"; // 5 hours later
    expect(isTooLateToCancel(appt)).toBe(false);
  });

  it("3 שעות לפני → true (ביטול מאוחר)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00Z"));
    const appt = "2026-06-14T11:00:00Z"; // 3 hours later
    expect(isTooLateToCancel(appt)).toBe(true);
  });

  it("בדיוק 4 שעות → true (גבול שייך לאיחור)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00Z"));
    const appt = "2026-06-14T12:00:00Z"; // exactly 4 hours
    // isTooLateToCancel: hoursUntil < 4 → at exactly 4h → false (מעל 4 שעות = חינם)
    expect(isTooLateToCancel(appt)).toBe(false);
  });

  it("1 שעה לפני → true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00Z"));
    const appt = "2026-06-14T09:00:00Z";
    expect(isTooLateToCancel(appt)).toBe(true);
  });
});
