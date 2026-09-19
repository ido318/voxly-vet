"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Tabs } from "@/components/dashboard/ui/tabs";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { ActiveProblems } from "@/components/dashboard/medical-record/active-problems";
import { ProblemListEditor } from "@/components/dashboard/medical-record/problem-list-editor";
import { AlertBanner } from "@/components/dashboard/medical-record/alert-banner";
import { MedicalTimeline } from "@/components/dashboard/medical-record/medical-timeline";
import { VitalsTrend } from "@/components/dashboard/medical-record/vitals-trend";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import { PatientContextDrawer } from "@/components/dashboard/patient-context-drawer";
import { PetProfileForm } from "@/app/dashboard/pets/[petId]/pet-profile-form";
import { formatIsraelDate, formatIsraelDateTime } from "@/lib/israel-date";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit, VisitStatus } from "@/types/domain/visit";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { MedicalRecordTimelineItem } from "@/types/api/medical-record-timeline";

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  discontinued: "הופסק",
};

type Tab = "overview" | "medicalRecord" | "visits" | "vaccinations" | "medications" | "billing";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "סקירה" },
  { value: "medicalRecord", label: "תיק רפואי" },
  { value: "visits", label: "ביקורים" },
  { value: "vaccinations", label: "חיסונים" },
  { value: "medications", label: "תרופות" },
  { value: "billing", label: "חיובים" },
];

export function PetDetailTabs({
  pet,
  clinicId,
  visits,
  vaccinations,
  prescriptions,
  medicalRecord,
  timelineItems,
  owner,
}: {
  pet: Pet;
  clinicId: string;
  visits: Visit[];
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
  medicalRecord: MedicalRecord | null;
  timelineItems: MedicalRecordTimelineItem[];
  owner: Customer | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Btn type="button" variant="soft" size="sm" onClick={() => setContextOpen(true)}>
          הקשר מטופל
        </Btn>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} variant="underline" />

      <div className="pt-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <Card>
              <PetProfileForm pet={pet} />
            </Card>
          </div>
        )}

        {tab === "medicalRecord" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <MedicalTimeline items={timelineItems} />

            <div className="space-y-3">
              <Card>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">סיכום</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">
                  {medicalRecord?.summary || "אין עדיין סיכום רפואי קבוע."}
                </p>
              </Card>

              <AlertBanner
                allergies={pet.allergies}
                chronicConditions={pet.chronicConditions}
                alerts={medicalRecord?.alerts ?? []}
              />

              <ActiveProblems problems={medicalRecord?.activeProblemList ?? []} />

              <ProblemListEditor petId={pet.id} activeProblemList={medicalRecord?.activeProblemList ?? []} />

              <VitalsTrend items={timelineItems} />

              <Card>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">מניעה ותרופות</p>
                <div className="mt-2 space-y-2 text-xs text-[var(--text-primary)]">
                  <p>{vaccinations.length} חיסונים רשומים</p>
                  <p>{prescriptions.filter((rx) => rx.status === "active").length} מרשמים פעילים</p>
                  <p>{pet.currentMedications || "אין תרופות קבועות בפרופיל"}</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <Card noPad>
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">ביקורים</h3>
              <Link href={`/dashboard/visits/new?petId=${pet.id}`} className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
                + ביקור חדש
              </Link>
            </div>
            {visits.length === 0 ? (
              <EmptyState title="לא נרשמו ביקורים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--border-row)] px-2 pb-2">
                {visits.map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/dashboard/visits/${visit.id}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-2)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{formatIsraelDateTime(visit.startedAt)}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                    </div>
                    <Badge tone={visit.status === "completed" ? "done" : visit.status === "cancelled" ? "neutral" : "info"}>
                      {VISIT_STATUS_LABELS[visit.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "vaccinations" && (
          <Card noPad>
            <h3 className="px-5 pb-3 pt-5 text-[15px] font-semibold text-[var(--text-primary)]">חיסונים</h3>
            {vaccinations.length === 0 ? (
              <EmptyState title="לא נרשמו חיסונים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--border-row)] px-5 pb-5">
                {vaccinations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{v.vaccineName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatIsraelDate(v.administeredAt)}</p>
                    </div>
                    {v.nextDueAt && (
                      <Badge tone={new Date(v.nextDueAt) < new Date() ? "critical" : "done"}>
                        {new Date(v.nextDueAt) < new Date() ? "פג תוקף" : "בתוקף"} · {formatIsraelDate(v.nextDueAt)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "medications" && (
          <Card noPad>
            <h3 className="px-5 pb-3 pt-5 text-[15px] font-semibold text-[var(--text-primary)]">תרופות ומרשמים</h3>
            {prescriptions.length === 0 ? (
              <EmptyState title="אין מרשמים רשומים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--border-row)] px-5 pb-5">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{rx.medicationName}</p>
                      <Badge tone={rx.status === "active" ? "done" : "neutral"}>
                        {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-[var(--text-muted)]">{rx.instructions}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "billing" && (
          <Card>
            <InvoicesSection clinicId={clinicId} customerId={pet.customerId} petId={pet.id} />
          </Card>
        )}
      </div>

      <PatientContextDrawer
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        pet={pet}
        owner={owner}
        visits={visits}
        vaccinations={vaccinations}
        prescriptions={prescriptions}
        medicalRecord={medicalRecord}
      />
    </div>
  );
}
