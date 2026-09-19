// The 14-day booking window is a binding clinic decision (CLAUDE.md), but on
// the dashboard side it only ever existed as the list of date chips the
// wizard rendered.
//
// Nothing enforced it on the server: createAppointmentSchema bounded neither
// end of scheduledAt, and AppointmentService.createAppointment checked clinic
// membership, duration, customer/pet consistency and slot overlap — but not
// when the appointment was. A date a year out and a date in the past both
// validated. The agent has rejected both since #19 (bookingWindowRejection);
// this is the same rule on the other path in.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const CLINIC = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "22222222-2222-4222-8222-222222222222";
const PET = "33333333-3333-4333-8333-333333333333";

// A Sunday, 10:00 Israel time — mid-morning on an open day.
const NOW = new Date("2026-06-14T07:00:00Z");

const actor: ServiceActor = {
  userId: "44444444-4444-4444-8444-444444444444",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "owner" }],
};

function makeService() {
  const appointmentRepository = {
    findActiveOverlaps: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    create: vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "appt-1", clinicId: CLINIC, customerId: CUSTOMER, petId: PET },
    }),
  } as unknown as AppointmentRepository;

  const service = new AppointmentService(
    appointmentRepository,
    {
      findById: vi.fn().mockResolvedValue({ ok: true, value: { id: CUSTOMER, clinicId: CLINIC } }),
    } as unknown as CustomerRepository,
    {
      findById: vi
        .fn()
        .mockResolvedValue({ ok: true, value: { id: PET, clinicId: CLINIC, customerId: CUSTOMER } }),
    } as unknown as PetRepository,
    { logAction: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
  );

  return { service, appointmentRepository };
}

function input(scheduledAt: string) {
  return {
    clinicId: CLINIC,
    customerId: CUSTOMER,
    petId: PET,
    appointmentType: "checkup" as const,
    source: "front_desk" as const,
    scheduledAt,
    durationMinutes: 40,
    reason: null,
    notes: null,
  };
}

describe("createAppointment booking window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a date inside the window", async () => {
    const { service, appointmentRepository } = makeService();

    const result = await service.createAppointment(actor, input("2026-06-16T09:00:00+03:00"));

    expect(result.ok).toBe(true);
    expect(vi.mocked(appointmentRepository.create)).toHaveBeenCalled();
  });

  it("rejects a date past the 14-day window", async () => {
    const { service, appointmentRepository } = makeService();

    const result = await service.createAppointment(actor, input("2027-06-01T09:00:00+03:00"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("14");
    // The row must never be written, not merely reported afterwards.
    expect(vi.mocked(appointmentRepository.create)).not.toHaveBeenCalled();
  });

  it("rejects a date in the past", async () => {
    const { service, appointmentRepository } = makeService();

    const result = await service.createAppointment(actor, input("2026-06-01T09:00:00+03:00"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("בעבר");
    expect(vi.mocked(appointmentRepository.create)).not.toHaveBeenCalled();
  });

  it("rejects earlier today — the window is a date range, the past is not bookable", async () => {
    const { service } = makeService();

    // 08:00 Israel on the same day, two hours before NOW.
    const result = await service.createAppointment(actor, input("2026-06-14T08:00:00+03:00"));

    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable scheduledAt instead of writing a NaN date", async () => {
    const { service, appointmentRepository } = makeService();

    const result = await service.createAppointment(actor, input("not-a-date"));

    expect(result.ok).toBe(false);
    expect(vi.mocked(appointmentRepository.create)).not.toHaveBeenCalled();
  });
});
