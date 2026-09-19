// These values are binding clinic decisions (CLAUDE.md, 2026-06-11). They
// used to live in two hand-maintained copies, agent/src/lib/appointments.ts
// and app/lib/appointment-rules.ts, which agreed only because nobody had
// edited one of them yet — the same shape of drift that produced a real SMS
// wording bug before the templates were unified here.
import { describe, expect, it } from "vitest";
import {
  VISIT_TYPE_CONFIG,
  VISIT_TYPE_VALUES,
  effectiveDuration,
  getVisitConfig,
} from "../src/visit-types";

describe("visit type config", () => {
  // The table from CLAUDE.md, restated so a silent edit to a duration has to
  // change this file too.
  it.each([
    ["checkup", 30, 10, 40],
    ["home_visit", 60, 30, 90],
    ["vaccination", 20, 10, 30],
    ["phone_consultation", 20, 0, 20],
    ["neutering", 30, 10, 40],
  ])("%s is %i + %i = %i minutes", (type, visit, buffer, effective) => {
    expect(VISIT_TYPE_CONFIG[type as never]).toMatchObject({
      durationMin: visit,
      bufferMin: buffer,
    });
    expect(effectiveDuration(type)).toBe(effective);
  });

  it("requires approval for neutering and nothing else", () => {
    const needsApproval = VISIT_TYPE_VALUES.filter((t) => VISIT_TYPE_CONFIG[t].requiresApproval);
    expect(needsApproval).toEqual(["neutering"]);
  });

  it("gives every type a Hebrew label — these are spoken and printed in SMS", () => {
    for (const type of VISIT_TYPE_VALUES) {
      expect(VISIT_TYPE_CONFIG[type].labelHe, type).toMatch(/[֐-׿]/);
    }
  });

  it("falls back to `other` rather than throwing on an unknown type", () => {
    expect(getVisitConfig("no_such_type")).toBe(VISIT_TYPE_CONFIG.other);
    expect(effectiveDuration("no_such_type")).toBe(30);
  });
});
