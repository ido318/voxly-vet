import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { VisitActions } from "@/app/dashboard/visits/visit-actions";
import { VisitAiSummarySection } from "@/app/dashboard/visits/visit-ai-summary-section";
import { VisitPrescriptionsSection } from "@/app/dashboard/visits/visit-prescriptions-section";
import { VisitShareSection } from "@/app/dashboard/visits/visit-share-section";
import { VisitVaccinationsSection } from "@/app/dashboard/visits/visit-vaccinations-section";
import { VisitWorkspace } from "@/app/dashboard/visits/visit-workspace";
import { PreVisitBriefCard } from "@/app/dashboard/voice/pre-visit-brief-card";
import { VisitChargesPanel } from "@/components/dashboard/billing/visit-charges-panel";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Customer } from "@/types/domain/customer";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { ClinicRole } from "@/types/domain/clinic";
import type { MeResponse } from "@/types/api/me";
import type { Visit, VisitStatus } from "@/types/domain/visit";
import type { VisitCharge } from "@/types/domain/visit-charge";
import type { Vital } from "@/types/domain/vital";
import type { VoiceCall } from "@/types/domain/voice-call";

const AI_SUMMARY_ROLES: ClinicRole[] = ["owner", "admin", "veterinarian"];

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

type Params = { params: Promise<{ visitId: string }> };

export default async function VisitDetailPage({ params }: Params) {
  const { visitId } = await params;
  const [visit, me] = await Promise.all([
    dashboardApiFetch<Visit>(`/api/visits/${visitId}`),
    dashboardApiFetch<MeResponse>("/api/me"),
  ]);

  if (!visit) {
    return (
      <section className="rounded-[var(--radius-3)] border border-[var(--red-100)] bg-[var(--red-50)] p-6 text-sm text-[var(--red-700)]">
        הביקור לא נמצא.
      </section>
    );
  }

  const [notesData, prescriptionsData, vaccinationsData, vitalsData, chargesData, customer, pet, appointment] = await Promise.all([
    dashboardApiFetch<{ items: MedicalNote[] }>(`/api/visits/${visitId}/notes`),
    dashboardApiFetch<{ items: Prescription[] }>(`/api/visits/${visitId}/prescriptions`),
    dashboardApiFetch<{ items: Vaccination[] }>(
      `/api/pets/${visit.petId}/vaccinations?clinicId=${encodeURIComponent(visit.clinicId)}`,
    ),
    dashboardApiFetch<{ items: Vital[] }>(`/api/visits/${visitId}/vitals`),
    dashboardApiFetch<{ items: VisitCharge[] }>(`/api/visits/${visitId}/charges`),
    dashboardApiFetch<Customer>(`/api/customers/${visit.customerId}`),
    dashboardApiFetch<Pet>(`/api/pets/${visit.petId}`),
    visit.appointmentId
      ? dashboardApiFetch<Appointment>(`/api/appointments/${visit.appointmentId}`)
      : Promise.resolve(null),
  ]);
  const visitCalls = await dashboardApiFetch<{ items: VoiceCall[] }>(
    `/api/voice/calls?visitId=${encodeURIComponent(visit.id)}&limit=3`,
  );
  const appointmentCalls = visitCalls?.items.length || !visit.appointmentId
    ? visitCalls
    : await dashboardApiFetch<{ items: VoiceCall[] }>(
        `/api/voice/calls?appointmentId=${encodeURIComponent(visit.appointmentId)}&limit=3`,
      );
  const customerCalls = appointmentCalls?.items.length
    ? appointmentCalls
    : await dashboardApiFetch<{ items: VoiceCall[] }>(
        `/api/voice/calls?customerId=${encodeURIComponent(visit.customerId)}&limit=3`,
      );

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-5 p-6">
      <Link href={`/dashboard/pets/${visit.petId}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← חזרה לכרטיס המטופל
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-5">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">מפגש טיפולי</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{formatIsraelDateTime(visit.startedAt)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-end">
            <p className="text-[11px] text-[var(--text-muted)]">מטופל</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{pet?.name ?? visit.petId}</p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-[var(--text-muted)]">בעלים</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{customer?.fullName ?? visit.customerId}</p>
          </div>
          <Badge tone={visit.status === "completed" ? "done" : visit.status === "cancelled" ? "neutral" : "info"}>
            {VISIT_STATUS_LABELS[visit.status]}
          </Badge>
        </div>
      </div>

      <Card>
        <h3 id="reason-and-pre-visit" className="text-[15px] font-semibold text-[var(--text-primary)]">רקע לביקור</h3>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">סיבת הביקור</p>
            <p className="mt-1 text-[var(--text-primary)]">{visit.chiefComplaint ?? appointment?.reason ?? "לא צוינה סיבה"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">מקור</p>
            <p className="mt-1 text-[var(--text-primary)]">
              {appointment
                ? `${appointment.source} · ${appointment.appointmentType}`
                : "ביקור ללא תור מקושר"}
            </p>
          </div>
        </div>
        {appointment?.notes && (
          <div className="mt-3 rounded-[var(--radius-2)] bg-[var(--surface-sunken)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">הערות מהתור</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{appointment.notes}</p>
          </div>
        )}
      </Card>

      <PreVisitBriefCard calls={customerCalls?.items ?? []} />

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">סיכומי ביקור</h3>
        <div className="mt-3">
          <VisitAiSummarySection
            visitId={visit.id}
            visitVersion={visit.version}
            visitStatus={visit.status}
            manualVisitSummary={visit.manualVisitSummary}
            aiVisitSummary={visit.aiVisitSummary}
            canUseAi={
              me?.memberships.some(
                (m) =>
                  m.clinicId === visit.clinicId && AI_SUMMARY_ROLES.includes(m.role),
              ) ?? false
            }
          />
        </div>
      </Card>

      <VisitWorkspace
        visit={visit}
        notes={notesData?.items ?? []}
        vitals={vitalsData?.items ?? []}
      />

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">מרשמים</h3>
        <div className="mt-3">
          <VisitPrescriptionsSection
            visitId={visit.id}
            initialPrescriptions={prescriptionsData?.items ?? []}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">חיסונים</h3>
        <div className="mt-3">
          <VisitVaccinationsSection
            visitId={visit.id}
            clinicId={visit.clinicId}
            customerId={visit.customerId}
            petId={visit.petId}
            initialVaccinations={vaccinationsData?.items ?? []}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">חיובי ביקור</h3>
        <div className="mt-3">
          <VisitChargesPanel visitId={visit.id} clinicId={visit.clinicId} charges={chargesData?.items ?? []} />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">שליחה ללקוח</h3>
        <div className="mt-3">
          <VisitShareSection
            visitId={visit.id}
            hasSummary={Boolean(visit.aiVisitSummary ?? visit.manualVisitSummary)}
            hasPrescriptions={
              (prescriptionsData?.items ?? []).some((p) => p.status === "active")
            }
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">פעולות נוספות</h3>
        <div className="mt-3">
          <VisitActions
            visitId={visit.id}
            currentVersion={visit.version}
            currentStatus={visit.status}
          />
        </div>
      </Card>
    </div>
  );
}
