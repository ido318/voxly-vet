"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
import type { Prescription } from "@/types/domain/prescription";

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  active: "פעיל",
  discontinued: "הופסק",
};

type Props = {
  visitId: string;
  initialPrescriptions: Prescription[];
};

export function VisitPrescriptionsSection({ visitId, initialPrescriptions }: Props) {
  const router = useRouter();
  const [medicationName, setMedicationName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicationName,
        instructions,
        notes: notes || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "הוספת המרשם נכשלה");
      return;
    }

    setMedicationName("");
    setInstructions("");
    setNotes("");
    router.refresh();
  }

  async function approvePrescription(prescriptionId: string) {
    setApprovingId(prescriptionId);
    setError(null);

    const response = await fetch(`/api/prescriptions/${prescriptionId}/approve`, {
      method: "POST",
    });

    setApprovingId(null);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "אישור המרשם נכשל");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        מרשם זה נרשם על ידי הצוות הווטרינרי בלבד. אין להסתמך על AI למינונים.
      </p>
      <ul className="space-y-2">
        {initialPrescriptions.length === 0 ? (
          <li className="text-sm text-[var(--text-faint)]">אין עדיין מרשמים.</li>
        ) : (
          initialPrescriptions.map((rx) => (
            <li key={rx.id} className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--text-primary)]">{rx.medicationName}</p>
                <Badge tone={rx.status === "active" ? "done" : rx.status === "draft" ? "pending" : "neutral"}>
                  {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{rx.instructions}</p>
              {rx.status === "draft" ? (
                <div className="mt-3">
                  <Btn
                    type="button"
                    size="sm"
                    variant="soft"
                    loading={approvingId === rx.id}
                    onClick={() => void approvePrescription(rx.id)}
                  >
                    אשר מרשם
                  </Btn>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--border-row)] pt-4">
        <input
          value={medicationName}
          onChange={(event) => setMedicationName(event.target.value)}
          required
          placeholder="שם התרופה"
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          rows={3}
          placeholder="מינון, תדירות, משך, הנחיות מיוחדות"
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="הערות (לא חובה)"
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
        <Btn type="submit" size="sm" loading={loading}>שמור טיוטת מרשם</Btn>
      </form>
    </div>
  );
}
