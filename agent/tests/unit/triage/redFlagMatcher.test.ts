import { describe, it, expect } from "vitest";
import { matchRedFlags } from "../../../src/triage/redFlagMatcher.js";

describe("matchRedFlags", () => {
  // ── 12 דגלים × trigger examples ──────────────────────────────────────────

  it("breathing_difficulty — trigger: לא נושם", () => {
    const flags = matchRedFlags("הכלב לא נושם");
    expect(flags.map((f) => f.id)).toContain("breathing_difficulty");
  });

  it("breathing_difficulty — trigger: לשון סגולה", () => {
    const flags = matchRedFlags("לשון סגולה ונשימה קשה");
    expect(flags.map((f) => f.id)).toContain("breathing_difficulty");
  });

  it("breathing_difficulty — trigger: פה פתוח", () => {
    const flags = matchRedFlags("יושב עם פה פתוח ולא זז");
    expect(flags.map((f) => f.id)).toContain("breathing_difficulty");
  });

  it("unconsciousness_collapse — trigger: התמוטט", () => {
    const flags = matchRedFlags("הכלב התמוטט ולא קם");
    expect(flags.map((f) => f.id)).toContain("unconsciousness_collapse");
  });

  it("unconsciousness_collapse — trigger: לא מגיב", () => {
    const flags = matchRedFlags("החתול לא מגיב לכלום");
    expect(flags.map((f) => f.id)).toContain("unconsciousness_collapse");
  });

  it("seizures — trigger: פרכוסים", () => {
    const flags = matchRedFlags("יש לו פרכוסים");
    expect(flags.map((f) => f.id)).toContain("seizures");
  });

  it("seizures — trigger: עוויתות", () => {
    const flags = matchRedFlags("הכלב עם עוויתות חזקות");
    expect(flags.map((f) => f.id)).toContain("seizures");
  });

  it("significant_bleeding — trigger: דם לא עוצר", () => {
    const flags = matchRedFlags("יש דם לא עוצר מהרגל");
    expect(flags.map((f) => f.id)).toContain("significant_bleeding");
  });

  it("suspected_poisoning — trigger: בלע כדורים", () => {
    const flags = matchRedFlags("בלע כדורים שלי");
    expect(flags.map((f) => f.id)).toContain("suspected_poisoning");
  });

  it("suspected_poisoning — trigger: אכל רעל", () => {
    const flags = matchRedFlags("אכל רעל בגינה");
    expect(flags.map((f) => f.id)).toContain("suspected_poisoning");
  });

  it("suspected_poisoning — trigger: רעל עכברים", () => {
    const flags = matchRedFlags("הכלב אכל רעל עכברים בגינה");
    expect(flags.map((f) => f.id)).toContain("suspected_poisoning");
  });

  it("severe_trauma — trigger: נפגע ממכונית", () => {
    const flags = matchRedFlags("נפגע ממכונית ברחוב");
    expect(flags.map((f) => f.id)).toContain("severe_trauma");
  });

  it("severe_trauma — trigger: נדרס", () => {
    const flags = matchRedFlags("הכלב נדרס עכשיו");
    expect(flags.map((f) => f.id)).toContain("severe_trauma");
  });

  it("abdominal_swelling_gdv — trigger: בטן נפוחה (כלב)", () => {
    const flags = matchRedFlags("בטן נפוחה מאוד", [], "כלב");
    expect(flags.map((f) => f.id)).toContain("abdominal_swelling_gdv");
  });

  it("abdominal_swelling_gdv — לא מוחזר לחתול (applies_to=כלב בלבד)", () => {
    const flags = matchRedFlags("בטן נפוחה מאוד", [], "חתול");
    expect(flags.map((f) => f.id)).not.toContain("abdominal_swelling_gdv");
  });

  it("cat_not_urinating — trigger: לא עשה פיפי (חתול)", () => {
    const flags = matchRedFlags("לא עשה פיפי כבר יומיים", [], "חתול");
    expect(flags.map((f) => f.id)).toContain("cat_not_urinating");
  });

  it("cat_not_urinating — trigger: לא השתין (חתול)", () => {
    const flags = matchRedFlags("החתול לא השתין מאתמול", [], "חתול");
    expect(flags.map((f) => f.id)).toContain("cat_not_urinating");
  });

  it("cat_not_urinating — trigger: נכנס ויוצא מהארגז (חתול)", () => {
    const flags = matchRedFlags("החתול נכנס ויוצא מהארגז ולא מצליח", [], "חתול");
    expect(flags.map((f) => f.id)).toContain("cat_not_urinating");
  });

  it("vomiting_blood — trigger: הקיא דם", () => {
    const flags = matchRedFlags("הקיא דם הבוקר");
    expect(flags.map((f) => f.id)).toContain("vomiting_blood");
  });

  it("vomiting_blood — trigger: הצואה שחורה", () => {
    const flags = matchRedFlags("הצואה שחורה", [], "כלב");
    expect(flags.map((f) => f.id)).toContain("vomiting_blood");
  });

  it("vomiting_blood — trigger: דם בקקי", () => {
    const flags = matchRedFlags("ראיתי דם בקקי שלו", [], "כלב");
    expect(flags.map((f) => f.id)).toContain("vomiting_blood");
  });

  it("extreme_pain — trigger: צועק מכאב", () => {
    const flags = matchRedFlags("צועק מכאב כשנוגעים בו");
    expect(flags.map((f) => f.id)).toContain("extreme_pain");
  });

  it("heat_stroke — trigger: נשאר ברכב", () => {
    const flags = matchRedFlags("נשאר ברכב שעה בשמש");
    expect(flags.map((f) => f.id)).toContain("heat_stroke");
  });

  it("heat_stroke — trigger: מכת חום", () => {
    const flags = matchRedFlags("חשד למכת חום");
    expect(flags.map((f) => f.id)).toContain("heat_stroke");
  });

  it("deep_open_wound — trigger: נשך כלב", () => {
    const flags = matchRedFlags("נשך כלב גדול");
    expect(flags.map((f) => f.id)).toContain("deep_open_wound");
  });

  it("deep_open_wound — trigger: פצע עמוק", () => {
    const flags = matchRedFlags("יש פצע עמוק ברגל");
    expect(flags.map((f) => f.id)).toContain("deep_open_wound");
  });

  // ── תסמינים רגילים — לא מחזירים דגל ────────────────────────────────────

  it("תסמין רגיל — שיעול קל לא מפעיל דגל", () => {
    const flags = matchRedFlags("שיעול קל מאתמול");
    expect(flags).toHaveLength(0);
  });

  it("תסמין רגיל — חוסר תיאבון לא מפעיל דגל", () => {
    const flags = matchRedFlags("לא אכל היום כמעט כלום");
    expect(flags).toHaveLength(0);
  });

  it("תסמין רגיל — גרד לא מפעיל דגל", () => {
    const flags = matchRedFlags("מגרד את עצמו הרבה");
    expect(flags).toHaveLength(0);
  });

  it("תשובה שלילית — אין בטן נפוחה לא מפעיל GDV", () => {
    const flags = matchRedFlags("הוא הקיא פעמיים אבל אין בטן נפוחה ואין בטן קשה", [], "כלב");
    expect(flags.map((f) => f.id)).not.toContain("abdominal_swelling_gdv");
  });

  it("תשובה שלילית — לא מדמם לא מפעיל דימום משמעותי", () => {
    const flags = matchRedFlags("הפצע קטן והוא לא מדמם", [], "כלב");
    expect(flags.map((f) => f.id)).not.toContain("significant_bleeding");
  });

  // ── additional_signs_he ──────────────────────────────────────────────────

  it("דגל ב-additional_signs_he", () => {
    const flags = matchRedFlags("לא אוכל טוב", ["מנסה להקיא ולא מצליח"], "כלב");
    expect(flags.map((f) => f.id)).toContain("abdominal_swelling_gdv");
  });

  // ── דגלים חדשים: eye_injury ──────────────────────────────────────────────

  it("eye_injury — trigger: עין מדממת", () => {
    const flags = matchRedFlags("יש לה עין מדממת");
    expect(flags.map((f) => f.id)).toContain("eye_injury");
  });

  it("eye_injury — trigger: עיוור פתאום", () => {
    const flags = matchRedFlags("הכלב עיוור פתאום לא רואה כלום");
    expect(flags.map((f) => f.id)).toContain("eye_injury");
  });

  // ── דגלים חדשים: dystocia ────────────────────────────────────────────────

  it("dystocia — trigger: לא יכולה ללדת", () => {
    const flags = matchRedFlags("הכלבה לא יכולה ללדת כבר שעתיים");
    expect(flags.map((f) => f.id)).toContain("dystocia");
  });

  it("dystocia — trigger: השליה לא יוצאת", () => {
    const flags = matchRedFlags("השליה לא יוצאת אחרי הלידה");
    expect(flags.map((f) => f.id)).toContain("dystocia");
  });

  // ── דגלים חדשים: animal_attack ──────────────────────────────────────────

  it("animal_attack — trigger: כלב תקף", () => {
    const flags = matchRedFlags("כלב תקף אותו בגינה");
    expect(flags.map((f) => f.id)).toContain("animal_attack");
  });

  it("animal_attack — trigger: ננשך על ידי כלב", () => {
    const flags = matchRedFlags("ננשך על ידי כלב גדול בפארק");
    expect(flags.map((f) => f.id)).toContain("animal_attack");
  });

  // ── דגלים חדשים: snake_bite ─────────────────────────────────────────────

  it("snake_bite — trigger: הכשת נחש", () => {
    const flags = matchRedFlags("חשד להכשת נחש בשדה");
    expect(flags.map((f) => f.id)).toContain("snake_bite");
  });

  it("snake_bite — trigger: נשך אותו נחש", () => {
    const flags = matchRedFlags("נשך אותו נחש ליד הבית");
    expect(flags.map((f) => f.id)).toContain("snake_bite");
  });

  // ── urgency score ─────────────────────────────────────────────────────────

  it("כל 16 הדגלים הם urgency >= 8", () => {
    const allFlags = matchRedFlags(
      "לא נושם, התמוטט, פרכוסים, דם לא עוצר, בלע כדורים, נפגע ממכונית, בטן נפוחה, לא עשה פיפי, הקיא דם, צועק מכאב, מכת חום, פצע עמוק, עין מדממת, לא יכולה ללדת, כלב תקף, הכשת נחש",
      [],
    );
    for (const flag of allFlags) {
      expect(flag.urgency).toBeGreaterThanOrEqual(8);
    }
  });
});
