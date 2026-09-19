import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { AnimalIcon } from "@/components/dashboard/icons";
import { Alert } from "@/components/dashboard/ui/alert";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { PetDetailTabs } from "@/app/dashboard/pets/[petId]/pet-detail-tabs";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit } from "@/types/domain/visit";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { MedicalRecordTimelineResponse } from "@/types/api/medical-record-timeline";

type Params = { params: Promise<{ petId: string }> };

const PET_SEX_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} שנים`;
  const months = Math.floor(diff / (30.4 * 24 * 3600 * 1000));
  return months > 0 ? `${months} חודשים` : "גור";
}

export default async function PetProfilePage({ params }: Params) {
  const { petId } = await params;
  const pet = await dashboardApiFetch<Pet>(`/api/pets/${petId}`);

  if (!pet) {
    return (
      <div className="mx-auto w-full max-w-[1000px] p-6">
        <Alert tone="critical">החיה לא נמצאה.</Alert>
      </div>
    );
  }

  const [visitsData, vaccinationsData, prescriptionsData, owner, medicalRecordData, timelineData] = await Promise.all([
    dashboardApiFetch<{ items: Visit[] }>(
      `/api/visits?petId=${encodeURIComponent(petId)}&clinicId=${encodeURIComponent(pet.clinicId)}&limit=10`,
    ),
    dashboardApiFetch<{ items: Vaccination[] }>(
      `/api/pets/${petId}/vaccinations?clinicId=${encodeURIComponent(pet.clinicId)}`,
    ),
    dashboardApiFetch<{ items: Prescription[] }>(`/api/pets/${petId}/prescriptions`),
    dashboardApiFetch<Customer>(`/api/customers/${pet.customerId}`),
    dashboardApiFetch<{ item: MedicalRecord }>(`/api/pets/${petId}/medical-record`),
    dashboardApiFetch<MedicalRecordTimelineResponse>(`/api/pets/${petId}/medical-record/timeline`),
  ]);

  const age = petAge(pet.birthDate);
  const hasAlerts = Boolean(pet.allergies || pet.chronicConditions);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <Link href={`/dashboard/clients?customerId=${pet.customerId}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← חזרה ללקוח
      </Link>

      {/* Hero */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-6">
        <div className="flex flex-wrap items-center gap-6">
          {pet.weight != null && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--text-muted)]">משקל אחרון</p>
              <p className="text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{pet.weight} ק״ג</p>
            </div>
          )}
          {age && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--text-muted)]">גיל</p>
              <p className="text-[20px] font-semibold text-[var(--text-primary)]">{age}</p>
            </div>
          )}
          {owner && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--text-muted)]">בעלים</p>
              <Link href={`/dashboard/clients?customerId=${owner.id}`} className="text-[16px] font-semibold text-[var(--accent)] hover:underline">
                {owner.fullName}
              </Link>
              {owner.phone && <p className="text-xs text-[var(--text-muted)]">{owner.phone}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="flex items-center gap-2">
              {pet.isNeutered && <Badge tone="neutral">מעוקר/ת</Badge>}
              <p className="text-[20px] font-semibold text-[var(--text-primary)]">{pet.name}</p>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
              {pet.sex ? ` · ${PET_SEX_LABELS[pet.sex] ?? pet.sex}` : ""}
            </p>
          </div>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--active-wash)]">
            <AnimalIcon species={pet.species} size={32} />
          </span>
        </div>
      </div>

      {/* Medical alerts */}
      {hasAlerts && (
        <div className="space-y-2">
          {pet.allergies && <Alert tone="critical" title="אלרגיה">{pet.allergies}</Alert>}
          {pet.chronicConditions && <Alert tone="pending" title="מצב כרוני">{pet.chronicConditions}</Alert>}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap justify-end gap-2">
        {owner?.phone && (
          <Btn href={`tel:${owner.phone}`} variant="soft" size="sm">
            התקשר לבעלים
          </Btn>
        )}
        <Btn href={`/dashboard/calendar?newAppointment=1&customerId=${pet.customerId}&petId=${pet.id}`} variant="soft" size="sm">
          קבע תור
        </Btn>
        <Btn href={`/dashboard/visits/new?petId=${pet.id}`} variant="primary" size="sm">
          פתח ביקור חדש
        </Btn>
      </div>

      <PetDetailTabs
        pet={pet}
        clinicId={pet.clinicId}
        visits={visitsData?.items ?? []}
        vaccinations={vaccinationsData?.items ?? []}
        prescriptions={prescriptionsData?.items ?? []}
        medicalRecord={medicalRecordData?.item ?? null}
        timelineItems={timelineData?.items ?? []}
        owner={owner ?? null}
      />
    </div>
  );
}
