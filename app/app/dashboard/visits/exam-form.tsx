"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";

const SYSTEMS = [
  "כללי",
  "עיניים/אוזניים/אף/גרון",
  "לב וכלי דם",
  "נשימה",
  "מערכת עיכול",
  "שרירים ושלד",
  "עור ופרווה",
  "נוירולוגי",
] as const;

type ExamStatus = "normal" | "abnormal";
type SystemState = { status: ExamStatus; note: string };

function initialFindings(): Record<string, SystemState> {
  return Object.fromEntries(SYSTEMS.map((system) => [system, { status: "normal", note: "" }]));
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

/**
 * Records per-system exam findings and saves them as a medical note (via the
 * same /notes endpoint VisitNotesSection uses) — there's no dedicated
 * physical-exam table, so "documenting an exam" means producing a note a
 * vet can read back, edit, and sign off on like any other.
 */
export function ExamForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [findings, setFindings] = useState<Record<string, SystemState>>(initialFindings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setStatus(system: string, status: ExamStatus) {
    setSaved(false);
    setFindings((prev) => ({
      ...prev,
      [system]: { status, note: status === "normal" ? "" : (prev[system]?.note ?? "") },
    }));
  }

  function setNote(system: string, note: string) {
    setSaved(false);
    setFindings((prev) => ({ ...prev, [system]: { status: prev[system]?.status ?? "normal", note } }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const content = SYSTEMS.map((system) => {
      const state = findings[system]!;
      const statusLabel = state.status === "normal" ? "תקין" : "חריג";
      const note = state.status === "abnormal" && state.note.trim() ? ` — ${state.note.trim()}` : "";
      return `${system}: ${statusLabel}${note}`;
    }).join("\n");

    const response = await fetch(`/api/visits/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteType: "general", content }),
    });

    setSaving(false);
    if (!response.ok) {
      setError(await readErrorMessage(response, "שמירת הבדיקה הגופנית נכשלה"));
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {SYSTEMS.map((system) => {
          const state = findings[system]!;
          return (
            <div key={system} className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-primary)]">{system}</p>
                <div className="flex gap-1">
                  <Btn
                    type="button"
                    size="sm"
                    variant={state.status === "normal" ? "soft" : "ghost"}
                    aria-pressed={state.status === "normal"}
                    onClick={() => setStatus(system, "normal")}
                  >
                    <Badge tone="done">תקין</Badge>
                  </Btn>
                  <Btn
                    type="button"
                    size="sm"
                    variant={state.status === "abnormal" ? "soft" : "ghost"}
                    aria-pressed={state.status === "abnormal"}
                    onClick={() => setStatus(system, "abnormal")}
                  >
                    <Badge tone="critical">חריג</Badge>
                  </Btn>
                </div>
              </div>
              {state.status === "abnormal" ? (
                <label className="mt-2 block space-y-1">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">תיאור הממצא</span>
                  <textarea
                    value={state.note}
                    onChange={(event) => setNote(system, event.target.value)}
                    rows={2}
                    className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm font-semibold text-[var(--status-critical-text)]">{error}</p> : null}
      {saved ? <p className="text-sm font-semibold text-[var(--status-done-text)]">הבדיקה נשמרה כהערה רפואית.</p> : null}
      <Btn type="submit" size="sm" loading={saving}>
        שמור בדיקה גופנית
      </Btn>
    </form>
  );
}
