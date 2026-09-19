import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RED_FLAG_LABELS,
  TRIAGE_DECISION_LABELS,
  formatEscalationReason,
  parseEscalationReason,
} from "@/lib/triage-labels";

/**
 * The red-flag wording is approved by Dr. Dana and frozen in the agent
 * workspace. The app cannot import across workspaces, so its mirror is checked
 * against the real list here — if the agent's list changes, this fails rather
 * than letting the dashboard show stale clinical wording.
 */
function agentRedFlags(): Record<string, string> {
  const source = readFileSync(
    join(process.cwd(), "..", "agent", "src", "knowledge", "red-flags.ts"),
    "utf8",
  );
  const entries = [...source.matchAll(/id:\s*"([^"]+)"\s*,\s*\n\s*name_he:\s*"([^"]+)"/g)];
  return Object.fromEntries(entries.map((m) => [m[1]!, m[2]!]));
}

describe("red flag labels", () => {
  it("mirrors every flag in the agent's approved list, with identical wording", () => {
    const source = agentRedFlags();

    expect(Object.keys(source).length).toBeGreaterThan(0);
    expect(RED_FLAG_LABELS).toEqual(source);
  });
});

describe("parseEscalationReason", () => {
  it("splits a triage reason into decision, flags and quote", () => {
    const parsed = parseEscalationReason(
      'triage: urgent_callback — flags: breathing_difficulty — "הכלב נושם בקושי"',
    );

    expect(parsed.decision).toBe("חזרה דחופה");
    expect(parsed.flags).toEqual(["קושי נשימה"]);
    expect(parsed.quote).toBe("הכלב נושם בקושי");
  });

  it("treats 'none' as no flags", () => {
    const parsed = parseEscalationReason('triage: after_hours_referral — flags: none — "לא אוכל"');

    expect(parsed.decision).toBe("פנייה מחוץ לשעות");
    expect(parsed.flags).toEqual([]);
  });

  it("maps every flag in a multi-flag reason", () => {
    const parsed = parseEscalationReason(
      'triage: emergency_referral — flags: seizures, vomiting_blood — "פרכוסים והקאות"',
    );

    expect(parsed.flags).toEqual(["פרכוסים", "הקאה עם דם"]);
  });

  it("passes an unrecognised reason through untouched", () => {
    const human = "דנה ביקשה לחזור ללקוח מחר בבוקר";

    expect(parseEscalationReason(human)).toEqual({
      decision: null,
      flags: [],
      quote: null,
      raw: human,
    });
    expect(formatEscalationReason(human)).toBe(human);
  });

  it("keeps an unknown flag id visible rather than dropping it", () => {
    const parsed = parseEscalationReason('triage: routine — flags: brand_new_flag — "משהו"');

    expect(parsed.flags).toEqual(["brand_new_flag"]);
  });

  it("handles a reason with no quote", () => {
    const parsed = parseEscalationReason("triage: urgent_callback — flags: none");

    expect(parsed.decision).toBe("חזרה דחופה");
    expect(parsed.quote).toBeNull();
  });

  it("covers every decision the triage engine can emit", () => {
    const agentSource = readFileSync(
      join(process.cwd(), "..", "agent", "src", "services", "triage.service.ts"),
      "utf8",
    );
    // The exported TriageDecision union is the authoritative list.
    const union = /export type TriageDecision =([\s\S]*?);/.exec(agentSource)?.[1] ?? "";
    const decisions = new Set([...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!));

    expect(decisions.size).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(TRIAGE_DECISION_LABELS).toHaveProperty(decision);
    }
  });
});
