import React from "react";
import { Badge } from "@/components/dashboard/ui/badge";

export function AlertBanner({
  allergies,
  chronicConditions,
  alerts,
}: {
  allergies: string | null;
  chronicConditions: string | null;
  alerts: unknown[];
}) {
  const items = [
    allergies ? `אלרגיה: ${allergies}` : null,
    chronicConditions ? `כרוני: ${chronicConditions}` : null,
    ...alerts.map((alert) => String(alert)),
  ].filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3">
        <p className="text-sm text-[var(--text-muted)]">אין אזהרות פעילות בתיק.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-2)] border border-[var(--red-500)] bg-[var(--red-50)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--red-700)]">אזהרות רפואיות</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item, index) => <Badge key={index} tone="critical">{item}</Badge>)}
      </div>
    </div>
  );
}
