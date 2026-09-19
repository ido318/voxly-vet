// The dashboard used to offer slots the database would then refuse.
//
// calendar.service.ts kept its own list of statuses that occupy a slot —
// scheduled / confirmed / pending_approval — while appointment.repository and
// the appointments_no_active_overlap exclusion constraint
// (20260831102335) both also count checked_in and in_visit. So a patient
// already in the room did not block their own slot: the wizard showed it as
// free, and the booking failed on the constraint.
//
// There was no test for availabilityByDate's filter at all, which is why three
// copies of one list could drift.
import { describe, expect, it, vi } from "vitest";
import { CalendarService } from "@/lib/services/calendar.service";
import { SLOT_BLOCKING_STATUSES, toIsraelLocalIso } from "@/lib/appointment-rules";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const CLINIC = "11111111-1111-4111-8111-111111111111";
// A Sunday: clinic hours 08:00–20:00.
const DATE = "2026-06-14";

const actor: ServiceActor = {
  userId: "22222222-2222-4222-8222-222222222222",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "owner" }],
};

function appointmentAt(hhmm: string, status: string) {
  return {
    id: `appt-${status}-${hhmm}`,
    clinicId: CLINIC,
    scheduledAt: toIsraelLocalIso(DATE, hhmm),
    durationMinutes: 40,
    status,
  };
}

function serviceWith(rows: ReturnType<typeof appointmentAt>[]): CalendarService {
  const repository = {
    list: vi.fn().mockResolvedValue({ ok: true, value: rows }),
  } as unknown as AppointmentRepository;
  return new CalendarService(repository);
}

// availabilityByDate emits .toISOString() (…Z) while toIsraelLocalIso builds
// …+03:00. Comparing those as strings makes every not.toContain assertion
// vacuously true, so compare instants.
async function freeSlots(rows: ReturnType<typeof appointmentAt>[]): Promise<number[]> {
  const result = await serviceWith(rows).availabilityByDate(actor, CLINIC, DATE, "Asia/Jerusalem", "checkup");
  expect(result.ok).toBe(true);
  if (!result.ok) return [];
  return result.value.availableSlots.map((iso) => new Date(iso).getTime());
}

function at(hhmm: string): number {
  return new Date(toIsraelLocalIso(DATE, hhmm)).getTime();
}

describe("availabilityByDate slot blocking", () => {
  it.each([...SLOT_BLOCKING_STATUSES])("treats a %s appointment as occupied", async (status) => {
    const slots = await freeSlots([appointmentAt("10:00", status)]);

    expect(slots).not.toContain(at("10:00"));
  });

  // The two the dashboard used to ignore, called out on their own so a
  // regression names itself.
  it("does not offer a slot held by a patient who is already checked in", async () => {
    const slots = await freeSlots([appointmentAt("10:00", "checked_in")]);

    expect(slots).not.toContain(at("10:00"));
  });

  it("does not offer a slot held by a visit in progress", async () => {
    const slots = await freeSlots([appointmentAt("10:00", "in_visit")]);

    expect(slots).not.toContain(at("10:00"));
  });

  it("still offers slots held by appointments that ended or were cancelled", async () => {
    const slots = await freeSlots([
      appointmentAt("10:00", "cancelled"),
      appointmentAt("11:00", "completed"),
    ]);

    expect(slots).toContain(at("10:00"));
    expect(slots).toContain(at("11:00"));
  });

  it("offers the whole open day when nothing is booked", async () => {
    const slots = await freeSlots([]);

    expect(slots.length).toBeGreaterThan(0);
    expect(slots).toContain(at("08:00"));
  });
});
