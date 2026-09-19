import { describe, expect, it } from "vitest";
import { decideHumanHandoff } from "../../../src/services/handoff.service.js";

// 2026-08-11 is a Tuesday. Times given with explicit +03:00 (Israel DST).
const DURING_HOURS = new Date("2026-08-11T10:00:00+03:00"); // Tue 10:00 → open
const AFTER_HOURS = new Date("2026-08-11T23:00:00+03:00"); // Tue 23:00 → closed
const NUMBER = "+972500000000";

describe("decideHumanHandoff", () => {
  it("transfers to the target number during business hours", () => {
    const d = decideHumanHandoff({ now: DURING_HOURS, targetNumber: NUMBER });
    expect(d.transfer).toBe(true);
    expect(d.escalate).toBe(false);
    expect(d.number).toBe(NUMBER);
  });

  it("escalates (no transfer) during business hours when no number is configured", () => {
    const d = decideHumanHandoff({ now: DURING_HOURS, targetNumber: null });
    expect(d.transfer).toBe(false);
    expect(d.escalate).toBe(true);
    expect(d.urgency).toBe(6);
    expect(d.number).toBeUndefined();
  });

  it("does not transfer outside business hours even with a number", () => {
    const d = decideHumanHandoff({ now: AFTER_HOURS, targetNumber: NUMBER });
    expect(d.transfer).toBe(false);
    expect(d.escalate).toBe(true);
  });

  it("raises urgency for an emergency outside business hours", () => {
    const d = decideHumanHandoff({ now: AFTER_HOURS, targetNumber: NUMBER, emergency: true });
    expect(d.transfer).toBe(false);
    expect(d.urgency).toBe(8);
  });
});
