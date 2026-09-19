"use client";
import React from "react";
import { Tabs } from "@/components/dashboard/ui/tabs";
import { Input } from "@/components/dashboard/ui/field";
import type { MedicalRecordTimelineType } from "@/types/api/medical-record-timeline";

const FILTERS: { value: MedicalRecordTimelineType | "all"; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "visit", label: "ביקורים" },
  { value: "medical_note", label: "הערות" },
  { value: "vital", label: "מדדים" },
  { value: "prescription", label: "מרשמים" },
  { value: "vaccination", label: "חיסונים" },
  { value: "lab_order", label: "מעבדה" },
];

export function RecordFilterBar({
  type,
  query,
  onTypeChange,
  onQueryChange,
}: {
  type: MedicalRecordTimelineType | "all";
  query: string;
  onTypeChange: (type: MedicalRecordTimelineType | "all") => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-row)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <Tabs variant="pill" size="sm" wrap value={type} onChange={onTypeChange} items={FILTERS} />
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="חיפוש בתיק"
        className="lg:w-56"
      />
    </div>
  );
}
