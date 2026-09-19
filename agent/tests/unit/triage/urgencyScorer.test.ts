import { describe, it, expect } from "vitest";
import { scoreUrgency } from "../../../src/triage/urgencyScorer.js";
import type { RedFlag } from "../../../src/triage/redFlagMatcher.js";

const makeFlag = (urgency: number): RedFlag => ({
  id: "test_flag",
  name_he: "דגל בדיקה",
  urgency,
  applies_to: ["כלב"],
  safe_question_he: "שאלה?",
});

describe("scoreUrgency", () => {
  it("דגל urgency=10 → score=10", () => {
    expect(scoreUrgency([makeFlag(10)], {})).toBe(10);
  });

  it("דגל urgency=8 → score=8", () => {
    expect(scoreUrgency([makeFlag(8)], {})).toBe(8);
  });

  it("שני דגלים — מחזיר את המקסימום", () => {
    expect(scoreUrgency([makeFlag(9), makeFlag(6)], {})).toBe(9);
  });

  it("ללא דגלים + ללא context → score=2", () => {
    expect(scoreUrgency([], {})).toBe(2);
  });

  it("ללא דגלים + duration 'פתאום' → score=5", () => {
    expect(scoreUrgency([], { durationHe: "זה קרה פתאום" })).toBe(5);
  });

  it("ללא דגלים + duration 'עכשיו' → score=5", () => {
    expect(scoreUrgency([], { durationHe: "זה קורה עכשיו" })).toBe(5);
  });

  it("ללא דגלים + duration 'שבוע' → score=2", () => {
    expect(scoreUrgency([], { durationHe: "כבר שבוע" })).toBe(2);
  });

  it("ללא דגלים + duration 'יומיים' → score=4", () => {
    expect(scoreUrgency([], { durationHe: "כבר יומיים" })).toBe(4);
  });
});
