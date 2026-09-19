import React from "react";
import { Badge } from "@/components/dashboard/ui/badge";
import { formatIsraelDate } from "@/lib/israel-date";
import { PROBLEM_SEVERITY_BADGE_TONE, PROBLEM_SEVERITY_LABELS } from "@/components/dashboard/medical-record/problem-severity";
import type { ProblemListEntry } from "@/types/domain/medical-record";

// The DB CHECK constraint on active_problem_list only enforces "is a jsonb
// array" — it does not guarantee onsetDate is a parseable date. formatIsraelDate
// throws on an invalid value, so guard it rather than let one bad legacy/manual
// row crash this whole tab.
function formatOnsetDate(value: string): string {
  return Number.isNaN(new Date(value).getTime()) ? value : formatIsraelDate(value);
}

/** One problem-list entry's read-only rendering — shared by ActiveProblems and
 * PatientContextDrawer so the two surfaces never drift apart. */
export function ProblemListEntryRow({ problem }: { problem: ProblemListEntry }) {
  return (
    <div className="rounded-[var(--radius-1)] bg-[var(--surface-sunken)] px-2 py-1.5 text-xs text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-[var(--text-primary)]">
          <span className="font-normal text-[var(--text-muted)]">מצב: </span>
          {problem.condition}
        </p>
        {problem.severity && (
          <Badge tone={PROBLEM_SEVERITY_BADGE_TONE[problem.severity]}>
            {PROBLEM_SEVERITY_LABELS[problem.severity]}
          </Badge>
        )}
      </div>
      {(problem.onsetDate || problem.notes) && (
        <div className="mt-1 space-y-0.5 text-[11px] text-[var(--text-muted)]">
          {problem.onsetDate && <p>תאריך תחילה: {formatOnsetDate(problem.onsetDate)}</p>}
          {problem.notes && <p>הערות: {problem.notes}</p>}
        </div>
      )}
    </div>
  );
}

export function ActiveProblems({ problems }: { problems: ProblemListEntry[] }) {
  return (
    <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">בעיות פעילות</p>
      <div className="mt-2 space-y-1.5">
        {problems.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">אין בעיות פעילות רשומות.</p>
        ) : (
          problems.map((problem, index) => <ProblemListEntryRow key={index} problem={problem} />)
        )}
      </div>
    </div>
  );
}
