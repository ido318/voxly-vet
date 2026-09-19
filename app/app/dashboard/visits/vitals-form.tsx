"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input } from "@/components/dashboard/ui/field";
import type { Vital } from "@/types/domain/vital";

function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function VitalsForm({
  visitId,
  initialVitals,
}: {
  visitId: string;
  initialVitals: Vital[];
}) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [heartRateBpm, setHeartRateBpm] = useState("");
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState("");
  const [painScore, setPainScore] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: numberOrNull(weightKg),
        temperatureC: numberOrNull(temperatureC),
        heartRateBpm: numberOrNull(heartRateBpm),
        respiratoryRateBpm: numberOrNull(respiratoryRateBpm),
        painScore: numberOrNull(painScore),
        notes: notes.trim() || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "שמירת המדדים נכשלה");
      return;
    }

    setWeightKg("");
    setTemperatureC("");
    setHeartRateBpm("");
    setRespiratoryRateBpm("");
    setPainScore("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {initialVitals.length > 0 && (
        <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">מדד אחרון</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {initialVitals[0]?.weightKg ?? "-"} ק״ג · {initialVitals[0]?.temperatureC ?? "-"} מעלות · {initialVitals[0]?.heartRateBpm ?? "-"} פעימות לדקה
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="משקל (ק״ג)" htmlFor="vitals-weight-kg">
          <Input
            id="vitals-weight-kg"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            type="number"
            step="0.01"
          />
        </Field>
        <Field label="טמפרטורה (°C)" htmlFor="vitals-temperature-c">
          <Input
            id="vitals-temperature-c"
            value={temperatureC}
            onChange={(event) => setTemperatureC(event.target.value)}
            type="number"
            step="0.1"
          />
        </Field>
        <Field label="דופק (פעימות לדקה)" htmlFor="vitals-heart-rate-bpm">
          <Input
            id="vitals-heart-rate-bpm"
            value={heartRateBpm}
            onChange={(event) => setHeartRateBpm(event.target.value)}
            type="number"
          />
        </Field>
        <Field label="קצב נשימה (לדקה)" htmlFor="vitals-respiratory-rate-bpm">
          <Input
            id="vitals-respiratory-rate-bpm"
            value={respiratoryRateBpm}
            onChange={(event) => setRespiratoryRateBpm(event.target.value)}
            type="number"
          />
        </Field>
        <Field label="ציון כאב (0–10)" htmlFor="vitals-pain-score">
          <Input
            id="vitals-pain-score"
            value={painScore}
            onChange={(event) => setPainScore(event.target.value)}
            type="number"
            min={0}
            max={10}
          />
        </Field>
        <Field label="הערות" htmlFor="vitals-notes">
          <Input
            id="vitals-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="text-sm font-semibold text-[var(--status-critical-text)] sm:col-span-2">{error}</p>
        ) : null}
        <div className="sm:col-span-2">
          <Btn type="submit" size="sm" loading={loading}>שמור מדדים</Btn>
        </div>
      </form>
    </div>
  );
}
