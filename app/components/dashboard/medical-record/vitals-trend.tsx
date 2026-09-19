import React from "react";
import type { MedicalRecordTimelineItem } from "@/types/api/medical-record-timeline";
import type { Vital } from "@/types/domain/vital";

function isVital(data: MedicalRecordTimelineItem["data"]): data is Vital {
  return "recordedAt" in data && "weightKg" in data;
}

export function VitalsTrend({ items }: { items: MedicalRecordTimelineItem[] }) {
  const vitals = items
    .filter((item) => item.type === "vital" && isVital(item.data))
    .map((item) => item.data as Vital)
    .slice(0, 5);

  return (
    <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">מגמת מדדים</p>
      {vitals.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-faint)]">אין מדדים רשומים עדיין.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {vitals.map((vital) => (
            <div key={vital.id} className="grid grid-cols-3 gap-2 rounded-[var(--radius-1)] bg-[var(--surface-sunken)] px-2 py-1.5 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">{vital.weightKg ?? "-"} קג</span>
              <span className="font-semibold text-[var(--text-primary)]">{vital.temperatureC ?? "-"} מעלות</span>
              <span className="font-semibold text-[var(--text-primary)]">{vital.heartRateBpm ?? "-"} פעימות לדקה</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
