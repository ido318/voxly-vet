import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { VisitForm } from "@/app/dashboard/visits/visit-form";
import type { MeResponse } from "@/types/api/me";
import type { Appointment } from "@/types/domain/appointment";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type SearchParams = Promise<{
  petId?: string;
  customerId?: string;
  appointmentId?: string;
}>;

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const context = await dashboardApiFetch<MeResponse>("/api/me");
  const clinicId =
    context?.profile.defaultClinicId ?? context?.memberships[0]?.clinicId ?? null;

  let customerId = params.customerId ?? null;
  let petId = params.petId ?? null;
  let appointmentId = params.appointmentId ?? null;

  if (appointmentId) {
    const appointment = await dashboardApiFetch<Appointment>(
      `/api/appointments/${appointmentId}`,
    );
    if (appointment) {
      customerId = appointment.customerId;
      petId = appointment.petId;
      appointmentId = appointment.id;
    }
  }

  if (petId && !customerId) {
    const pet = await dashboardApiFetch<Pet>(`/api/pets/${petId}`);
    customerId = pet?.customerId ?? null;
  }

  // Deliberately no fallback to "the clinic's first customer and their first
  // pet": that silently opened the visit on an arbitrary animal, with nothing on
  // screen saying whose it was. Without context the vet picks, explicitly.
  const customersData = await dashboardApiFetch<{ items: Customer[] }>("/api/customers");
  const customers = customersData?.items ?? [];

  const petsData = customerId
    ? await dashboardApiFetch<{ items: Pet[] }>(`/api/customers/${customerId}/pets`)
    : null;
  const pets = petsData?.items ?? [];

  if (!clinicId) {
    return (
      <section className="rounded-[var(--radius-3)] border border-[var(--amber-500)] bg-[var(--amber-50)] p-6 text-sm text-[var(--amber-600)]">
        לא נמצאה מרפאה למשתמש הזה.
      </section>
    );
  }

  if (customers.length === 0) {
    return (
      <section className="rounded-[var(--radius-3)] border border-[var(--amber-500)] bg-[var(--amber-50)] p-6 text-sm text-[var(--amber-600)]">
        כדי ליצור ביקור, צריך שיהיה לפחות לקוח אחד עם חיה רשומה במרפאה.
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[640px] space-y-4 p-6">
      <div>
        <Link href="/dashboard/visits" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          ← חזרה לביקורים
        </Link>
        <h2 className="mt-2 text-[22px] font-semibold text-[var(--text-primary)]">ביקור חדש</h2>
      </div>

      <div className="rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-6">
        <VisitForm
          clinicId={clinicId}
          customers={customers}
          initialCustomerId={customerId}
          initialPetId={petId}
          initialPets={pets}
          appointmentId={appointmentId}
          contextLocked={Boolean(appointmentId && customerId && petId)}
        />
      </div>
    </section>
  );
}
