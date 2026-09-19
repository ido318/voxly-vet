import type { ProblemListSeverity } from "@/types/domain/medical-record";

// Shared by every surface that renders or edits a ProblemListEntry's severity
// (active-problems.tsx, problem-list-editor.tsx, patient-context-drawer.tsx),
// so none of them has to import it from a sibling display component.
export const PROBLEM_SEVERITY_LABELS: Record<ProblemListSeverity, string> = {
  mild: "קל",
  moderate: "בינוני",
  severe: "חמור",
};

export const PROBLEM_SEVERITY_BADGE_TONE: Record<ProblemListSeverity, "done" | "pending" | "critical"> = {
  mild: "done",
  moderate: "pending",
  severe: "critical",
};
