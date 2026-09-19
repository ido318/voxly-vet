"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";
import { PROBLEM_SEVERITY_LABELS } from "@/components/dashboard/medical-record/problem-severity";
import type { ProblemListEntry, ProblemListSeverity } from "@/types/domain/medical-record";

type Props = {
  petId: string;
  activeProblemList: ProblemListEntry[];
};

type Draft = {
  condition: string;
  severity: ProblemListSeverity | "";
  onsetDate: string;
  notes: string;
};

const SEVERITY_OPTIONS: ProblemListSeverity[] = ["mild", "moderate", "severe"];

const fieldClass =
  "w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-xs font-normal text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const labelClass = "space-y-1 text-[11px] font-semibold text-[var(--text-secondary)]";

function emptyDraft(): Draft {
  return { condition: "", severity: "", onsetDate: "", notes: "" };
}

export function ProblemListEditor({ petId, activeProblemList }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<ProblemListEntry[]>(activeProblemList);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onAddDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const condition = draft.condition.trim();
    if (!condition) return;

    setItems([
      ...items,
      {
        condition,
        severity: draft.severity || null,
        onsetDate: draft.onsetDate || null,
        notes: draft.notes.trim() || null,
      },
    ]);
    setDraft(emptyDraft());
  }

  function onRemove(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function onSave() {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/pets/${petId}/medical-record`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeProblemList: items }),
    });

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const message = body?.error?.message ?? "שמירת רשימת הבעיות נכשלה";
      setError(message);
      toast(message, "error");
      return;
    }

    toast("רשימת הבעיות נשמרה", "success");
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">עריכת בעיות פעילות</p>
        <Btn type="button" size="sm" loading={saving} onClick={() => void onSave()}>
          שמור
        </Btn>
      </div>

      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((problem, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-1)] bg-[var(--surface-sunken)] px-2 py-1 text-xs"
            >
              <span className="font-semibold text-[var(--text-primary)]">
                {problem.condition}
                {problem.severity ? ` · ${PROBLEM_SEVERITY_LABELS[problem.severity]}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="flex-shrink-0 text-xs font-semibold text-[var(--red-600)] hover:underline"
              >
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAddDraft} className="mt-3 space-y-2 border-t border-[var(--border-hairline)] pt-3">
        <label className={labelClass}>
          מצב כרוני
          <input
            value={draft.condition}
            onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
            required
            className={fieldClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>
            חומרה
            <select
              value={draft.severity}
              onChange={(e) => setDraft({ ...draft, severity: e.target.value as ProblemListSeverity | "" })}
              className={fieldClass}
            >
              <option value="">לא צוין</option>
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {PROBLEM_SEVERITY_LABELS[severity]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            תאריך תחילה
            <input
              type="date"
              value={draft.onsetDate}
              onChange={(e) => setDraft({ ...draft, onsetDate: e.target.value })}
              className={fieldClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          הערות
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={2}
            className={fieldClass}
          />
        </label>

        {error ? <p className="text-xs font-semibold text-[var(--red-700)]">{error}</p> : null}

        <Btn type="submit" variant="soft" size="sm">
          הוסף בעיה
        </Btn>
      </form>
    </div>
  );
}
