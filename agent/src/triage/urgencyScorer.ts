import type { RedFlag } from "./redFlagMatcher.js";

export type TriageContext = {
  petAgeYears?: number;
  petWeightKg?: number;
  durationHe?: string;
};

const LONG_DURATION_KEYWORDS = ["שבוע", "שבועיים", "חודש", "הרבה זמן"];

export function scoreUrgency(flags: RedFlag[], context: TriageContext): number {
  if (flags.length === 0) {
    return baseScore(context);
  }

  const maxFlagScore = Math.max(...flags.map((f) => f.urgency));
  return maxFlagScore;
}

function baseScore(context: TriageContext): number {
  const { durationHe } = context;

  if (!durationHe) return 2;

  const lower = durationHe.toLowerCase();
  if (lower.includes("עכשיו") || lower.includes("פתאום") || lower.includes("הרגע")) {
    return 5;
  }
  if (LONG_DURATION_KEYWORDS.some((k) => lower.includes(k))) {
    return 2;
  }
  if (lower.includes("יומיים") || lower.includes("3 ימים") || lower.includes("שלושה ימים")) {
    return 4;
  }
  return 3;
}
