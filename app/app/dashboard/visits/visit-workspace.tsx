import React from "react";
import { Card } from "@/components/dashboard/ui/card";
import { VisitSectionNav } from "@/app/dashboard/visits/visit-section-nav";
import { AnamnesisForm } from "@/app/dashboard/visits/anamnesis-form";
import { VitalsForm } from "@/app/dashboard/visits/vitals-form";
import { ExamForm } from "@/app/dashboard/visits/exam-form";
import { SoapEditor } from "@/app/dashboard/visits/soap-editor";
import { VoiceSoapRecorder } from "@/app/dashboard/visits/voice-soap-recorder";
import { CloseVisitModal } from "@/app/dashboard/visits/close-visit-modal";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Visit } from "@/types/domain/visit";
import type { Vital } from "@/types/domain/vital";

export function VisitWorkspace({
  visit,
  notes,
  vitals,
}: {
  visit: Visit;
  notes: MedicalNote[];
  vitals: Vital[];
}) {
  return (
    <div className="space-y-5">
      <Card>
        <VisitSectionNav />
      </Card>
      <Card>
        <h3 id="anamnesis" className="text-[15px] font-semibold text-[var(--text-primary)]">אנמנזה</h3>
        <div className="mt-3">
          <AnamnesisForm chiefComplaint={visit.chiefComplaint} manualVisitSummary={visit.manualVisitSummary} />
        </div>
      </Card>
      <Card>
        <h3 id="vitals" className="text-[15px] font-semibold text-[var(--text-primary)]">מדדים חיוניים</h3>
        <div className="mt-3">
          <VitalsForm visitId={visit.id} initialVitals={vitals} />
        </div>
      </Card>
      <Card>
        <h3 id="physical-exam" className="text-[15px] font-semibold text-[var(--text-primary)]">בדיקה גופנית</h3>
        <div className="mt-3">
          <ExamForm visitId={visit.id} />
        </div>
      </Card>
      <Card>
        <h3 id="soap" className="text-[15px] font-bold text-[var(--text-primary)]">SOAP</h3>
        <div className="mt-3 space-y-4">
          <VoiceSoapRecorder visitId={visit.id} />
          <SoapEditor visitId={visit.id} initialNotes={notes} />
        </div>
      </Card>
      <Card>
        <h3 id="actions" className="text-[15px] font-semibold text-[var(--text-primary)]">סגירת ביקור</h3>
        <div className="mt-3">
          <CloseVisitModal visitId={visit.id} version={visit.version} />
        </div>
      </Card>
    </div>
  );
}
