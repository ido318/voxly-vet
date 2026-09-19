"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Vaccination } from "@/types/domain/vaccination";

type Props = {
  visitId: string;
  clinicId: string;
  customerId: string;
  petId: string;
  initialVaccinations: Vaccination[];
};

export function VisitVaccinationsSection({
  visitId,
  clinicId,
  customerId,
  petId,
  initialVaccinations,
}: Props) {
  const router = useRouter();
  const [vaccineName, setVaccineName] = useState("");
  const [administeredAt, setAdministeredAt] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visitLinked = initialVaccinations.filter((v) => v.visitId === visitId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/pets/${petId}/vaccinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        customerId,
        vaccineName,
        administeredAt: new Date(administeredAt).toISOString(),
        visitId,
        batchNumber: batchNumber || null,
        nextDueAt: nextDueAt || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "שמירת החיסון נכשלה");
      return;
    }

    setVaccineName("");
    setAdministeredAt("");
    setBatchNumber("");
    setNextDueAt("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {visitLinked.length === 0 ? (
          <li className="text-sm text-[var(--text-faint)]">אין חיסונים שמקושרים לביקור הזה.</li>
        ) : (
          visitLinked.map((v) => (
            <li key={v.id} className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3 text-sm">
              <p className="font-semibold text-[var(--text-primary)]">{v.vaccineName}</p>
              <p className="text-[var(--text-secondary)]">
                {formatIsraelDateTime(v.administeredAt)}
                {v.batchNumber ? ` · אצווה ${v.batchNumber}` : ""}
                {v.nextDueAt ? ` · תזכורת ${new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem" }).format(new Date(v.nextDueAt))}` : ""}
              </p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--border-row)] pt-4">
        <input
          value={vaccineName}
          onChange={(event) => setVaccineName(event.target.value)}
          required
          placeholder="שם החיסון"
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <input
          type="datetime-local"
          value={administeredAt}
          onChange={(event) => setAdministeredAt(event.target.value)}
          required
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <input
          value={batchNumber}
          onChange={(event) => setBatchNumber(event.target.value)}
          placeholder="מספר אצווה (לא חובה)"
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <input
          type="date"
          value={nextDueAt}
          onChange={(event) => setNextDueAt(event.target.value)}
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
        <Btn type="submit" size="sm" loading={loading}>שמור חיסון</Btn>
      </form>
    </div>
  );
}
