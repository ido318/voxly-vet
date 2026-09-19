import { describe, it, expect } from "vitest";
import {
  isWithinBusinessHours,
  decideTriage,
  EMERGENCY_SCRIPT,
  URGENT_CALLBACK_SCRIPT,
  AFTER_HOURS_SCRIPT,
  ROUTINE_SCRIPT,
} from "../../../src/services/triage.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// isWithinBusinessHours — DST-correct via Asia/Jerusalem
// ─────────────────────────────────────────────────────────────────────────────
// Reference: Israel summer = UTC+3, winter = UTC+2.
// Business hours: Sun–Thu 08:00-20:00, Fri 08:30-13:00, Sat closed.
// All timestamps below are UTC.

describe("isWithinBusinessHours", () => {
  // ── ימים/שעות שנמצאים בתוך שעות פעילות ─────────────────────────────────

  it("ראשון 14:00 Israel (summer, UTC+3) → within", () => {
    // 2026-07-05 Sunday 14:00 Israel = 11:00 UTC
    expect(isWithinBusinessHours(new Date("2026-07-05T11:00:00Z"))).toBe(true);
  });

  it("רביעי 08:00 Israel (winter, UTC+2) → within", () => {
    // 2026-01-07 Wednesday 08:00 Israel = 06:00 UTC
    expect(isWithinBusinessHours(new Date("2026-01-07T06:00:00Z"))).toBe(true);
  });

  it("חמישי 19:59 Israel → within", () => {
    // 2026-07-09 Thursday 19:59 Israel (summer) = 16:59 UTC
    expect(isWithinBusinessHours(new Date("2026-07-09T16:59:00Z"))).toBe(true);
  });

  it("שישי 12:30 Israel → within", () => {
    // 2026-07-10 Friday 12:30 Israel (summer) = 09:30 UTC
    expect(isWithinBusinessHours(new Date("2026-07-10T09:30:00Z"))).toBe(true);
  });

  it("שישי 08:30 Israel (פתיחה מדויקת) → within", () => {
    // 2026-07-10 Friday 08:30 Israel (summer) = 05:30 UTC
    expect(isWithinBusinessHours(new Date("2026-07-10T05:30:00Z"))).toBe(true);
  });

  // ── ימים/שעות שנמצאים מחוץ לשעות פעילות ─────────────────────────────────

  it("שבת כל שעה → not within", () => {
    // 2026-07-11 Saturday 12:00 Israel (summer) = 09:00 UTC
    expect(isWithinBusinessHours(new Date("2026-07-11T09:00:00Z"))).toBe(false);
  });

  it("ראשון 07:59 Israel → not within (לפני פתיחה)", () => {
    // 2026-07-05 Sunday 07:59 Israel (summer) = 04:59 UTC
    expect(isWithinBusinessHours(new Date("2026-07-05T04:59:00Z"))).toBe(false);
  });

  it("ראשון 20:00 Israel → not within (סגירה מדויקת — לא כולל)", () => {
    // 2026-07-05 Sunday 20:00 Israel (summer) = 17:00 UTC
    expect(isWithinBusinessHours(new Date("2026-07-05T17:00:00Z"))).toBe(false);
  });

  it("ראשון 23:00 Israel → not within", () => {
    // 2026-07-05 Sunday 23:00 Israel (summer) = 20:00 UTC
    expect(isWithinBusinessHours(new Date("2026-07-05T20:00:00Z"))).toBe(false);
  });

  it("שישי 13:00 Israel (סגירה מדויקת) → not within", () => {
    // 2026-07-10 Friday 13:00 Israel (summer) = 10:00 UTC
    expect(isWithinBusinessHours(new Date("2026-07-10T10:00:00Z"))).toBe(false);
  });

  it("שישי 08:29 Israel → not within (לפני פתיחת שישי)", () => {
    // 2026-07-10 Friday 08:29 Israel (summer) = 05:29 UTC
    expect(isWithinBusinessHours(new Date("2026-07-10T05:29:00Z"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decideTriage — 4 decisions
// ─────────────────────────────────────────────────────────────────────────────

// Fixed timestamp helpers (all UTC)
const WITHIN_HOURS = new Date("2026-07-08T11:00:00Z"); // Wednesday 14:00 Israel summer
const AFTER_HOURS  = new Date("2026-07-08T20:00:00Z"); // Wednesday 23:00 Israel summer
const SHABBAT      = new Date("2026-07-11T09:00:00Z"); // Saturday 12:00 Israel summer

describe("decideTriage — emergency_referral (urgency >= 8, any time)", () => {
  it("הכשת נחש → emergency_referral בשעות פעילות", () => {
    const r = decideTriage({ text: "הכשת נחש", now: WITHIN_HOURS });
    expect(r.decision).toBe("emergency_referral");
    expect(r.urgency).toBeGreaterThanOrEqual(8);
  });

  it("הכשת נחש → emergency_referral גם ב-23:00", () => {
    const r = decideTriage({ text: "הכשת נחש", now: AFTER_HOURS });
    expect(r.decision).toBe("emergency_referral");
  });

  it("הכשת נחש → emergency_referral גם בשבת", () => {
    const r = decideTriage({ text: "הכשת נחש", now: SHABBAT });
    expect(r.decision).toBe("emergency_referral");
  });

  it("כלב תקף → emergency_referral (animal_attack urgency=8)", () => {
    const r = decideTriage({ text: "כלב תקף אותו בגינה", now: WITHIN_HOURS });
    expect(r.decision).toBe("emergency_referral");
    expect(r.matchedFlags).toContain("animal_attack");
  });

  it("אכל שוקולד מריר שלם → emergency_referral", () => {
    // "בלע שוקולד" triggers suspected_poisoning (urgency=9)
    const r = decideTriage({ text: "אכל שוקולד מריר שלם, בלע שוקולד", now: WITHIN_HOURS });
    expect(r.decision).toBe("emergency_referral");
    expect(r.matchedFlags).toContain("suspected_poisoning");
  });
});

describe("decideTriage — urgent_callback (urgency 4-7, within hours)", () => {
  it("לא אוכל פתאום → urgent_callback בשעות פעילות", () => {
    // "פתאום" in text → baseScore=5 (no flags) → 4 <= 5 <= 7 + within hours
    const r = decideTriage({ text: "לא אוכל ושותה מעט, קרה פתאום", now: WITHIN_HOURS });
    expect(r.decision).toBe("urgent_callback");
    expect(r.withinBusinessHours).toBe(true);
  });
});

describe("decideTriage — after_hours_referral (urgency 4-7, outside hours)", () => {
  it("אותה תלונה דחופה ב-23:00 → after_hours_referral", () => {
    const r = decideTriage({ text: "לא אוכל ושותה מעט, קרה פתאום", now: AFTER_HOURS });
    expect(r.decision).toBe("after_hours_referral");
    expect(r.withinBusinessHours).toBe(false);
  });

  it("תלונה דחופה בשבת → after_hours_referral", () => {
    const r = decideTriage({ text: "לא אוכל ושותה מעט, קרה פתאום", now: SHABBAT });
    expect(r.decision).toBe("after_hours_referral");
  });
});

describe("decideTriage — routine (urgency < 4)", () => {
  it("טיפה מקיא ולא מרגיש טוב → routine, לא emergency", () => {
    const r = decideTriage({ text: "הכלב טיפה מקיא ולא מרגיש טוב", now: WITHIN_HOURS });
    expect(r.decision).toBe("routine");
    expect(r.matchedFlags).toHaveLength(0);
  });

  it("הוא השתעל פעם אחת → routine", () => {
    const r = decideTriage({ text: "הוא השתעל פעם אחת", now: WITHIN_HOURS });
    expect(r.decision).toBe("routine");
  });

  it("צולע קצת מאתמול → routine (score=3, no flags)", () => {
    const r = decideTriage({ text: "צולע קצת מאתמול", now: WITHIN_HOURS });
    expect(r.decision).toBe("routine");
  });

  it("שאלה על מחיר חיסון → routine, matchedFlags ריק", () => {
    const r = decideTriage({ text: "שאלה על מחיר חיסון, כמה עולה?", now: WITHIN_HOURS });
    expect(r.decision).toBe("routine");
    expect(r.matchedFlags).toHaveLength(0);
  });
});

describe("decideTriage — after_hours אסור לקבל ROUTINE_SCRIPT כשיש דגל", () => {
  it("דגל urgency 4-7 ב-23:00 → after_hours_referral, לא routine", () => {
    // יומיים של כאב כלשהו — baseScore=4 (יומיים) → after_hours
    const r = decideTriage({ text: "כואב לו הבטן כבר יומיים", now: AFTER_HOURS });
    expect(r.decision).toBe("after_hours_referral");
    expect(r.decision).not.toBe("routine");
  });
});

describe("decideTriage — matchedFlags מוחזר נכון", () => {
  it("snake_bite → matchedFlags מכיל snake_bite", () => {
    const r = decideTriage({ text: "נשך אותו נחש ליד הבית", now: WITHIN_HOURS });
    expect(r.matchedFlags).toContain("snake_bite");
  });

  it("ללא דגלים → matchedFlags ריק", () => {
    const r = decideTriage({ text: "שיעול קל מאתמול", now: WITHIN_HOURS });
    expect(r.matchedFlags).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot — 4 scripts (וודא שהם לא ריקים ומכילים מילות מפתח)
// ─────────────────────────────────────────────────────────────────────────────

describe("scripts snapshot — 4 נוסחים קבועים", () => {
  it("EMERGENCY_SCRIPT מכיל הפנייה לבית חולים", () => {
    expect(EMERGENCY_SCRIPT).toMatchSnapshot();
    expect(EMERGENCY_SCRIPT).toContain("בית חולים וטרינרי");
    expect(EMERGENCY_SCRIPT).toContain("אל תמתינו");
  });

  it("URGENT_CALLBACK_SCRIPT מכיל העברה לדנה + אזהרה", () => {
    expect(URGENT_CALLBACK_SCRIPT).toMatchSnapshot();
    expect(URGENT_CALLBACK_SCRIPT).toContain("דנה");
    expect(URGENT_CALLBACK_SCRIPT).toContain("בית חולים וטרינרי");
  });

  it("AFTER_HOURS_SCRIPT מכיל 'המרפאה סגורה' + הפנייה לביה\"ח", () => {
    expect(AFTER_HOURS_SCRIPT).toMatchSnapshot();
    expect(AFTER_HOURS_SCRIPT).toContain("המרפאה סגורה");
    expect(AFTER_HOURS_SCRIPT).toContain("דנה");
    expect(AFTER_HOURS_SCRIPT).not.toContain("מומלץ לא להמתין");
  });

  it("ROUTINE_SCRIPT מכיל הצעת תור ואזהרת 'אם מחמיר'", () => {
    expect(ROUTINE_SCRIPT).toMatchSnapshot();
    expect(ROUTINE_SCRIPT).toContain("תור");
    expect(ROUTINE_SCRIPT).toContain("מחמיר");
  });

  it("ROUTINE_SCRIPT לא מכיל הרגעה רפואית ('זה לא נשמע')", () => {
    expect(ROUTINE_SCRIPT).not.toContain("זה לא נשמע");
    expect(ROUTINE_SCRIPT).not.toContain("כנראה שום דבר");
  });
});
