"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import type { VisitStatus } from "@/types/domain/visit";

const STATUS_OPTIONS: VisitStatus[] = ["in_progress", "completed", "cancelled"];

const STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

type Props = {
  visitId: string;
  currentVersion: number;
  currentStatus: VisitStatus;
};

export function VisitActions({ visitId, currentVersion, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<VisitStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: currentVersion, status }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "עדכון הסטטוס נכשל");
      return;
    }
    router.refresh();
  }

  async function softDelete() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/visits/${visitId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: currentVersion }),
    });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "מחיקת הביקור נכשלה");
      return;
    }
    router.push("/dashboard/visits");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]" htmlFor="status">
          שינוי סטטוס
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as VisitStatus)}
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        >
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      <div className="flex gap-2">
        <Btn size="sm" loading={loading} onClick={updateStatus}>עדכן סטטוס</Btn>
        <Btn size="sm" variant="dangerSoft" disabled={loading} onClick={softDelete}>מחק ביקור</Btn>
      </div>
    </div>
  );
}
