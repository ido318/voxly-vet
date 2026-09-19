"use client";
import React from "react";

export function AnamnesisForm({
  chiefComplaint,
  manualVisitSummary,
}: {
  chiefComplaint: string | null;
  manualVisitSummary: string | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">תלונה עיקרית</p>
        <p className="mt-1 text-sm text-[var(--text-primary)]">{chiefComplaint ?? "לא צוינה תלונה עיקרית."}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">היסטוריה</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
          {manualVisitSummary ?? "אפשר להוסיף היסטוריה דרך SOAP או הערה רפואית."}
        </p>
      </div>
    </div>
  );
}
