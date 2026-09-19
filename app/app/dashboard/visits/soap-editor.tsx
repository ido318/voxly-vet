"use client";
import React from "react";
import { VisitNotesSection } from "@/app/dashboard/visits/visit-notes-section";
import type { MedicalNote } from "@/types/domain/medical-note";

export function SoapEditor({
  visitId,
  initialNotes,
}: {
  visitId: string;
  initialNotes: MedicalNote[];
}) {
  return (
    <div id="soap">
      <VisitNotesSection visitId={visitId} initialNotes={initialNotes} />
    </div>
  );
}
