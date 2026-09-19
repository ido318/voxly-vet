import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { Appointment } from "@/types/domain/appointment";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Visit } from "@/types/domain/visit";

const clinicId = "00000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000001";
const petId = "20000000-0000-4000-8000-000000000001";

const actor: ServiceActor = {
  userId: "30000000-0000-4000-8000-000000000001",
  clinicIds: [clinicId],
  defaultClinicId: clinicId,
  memberships: [{ clinicId, role: "staff" }],
};

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    clinicId,
    customerId,
    petId,
    appointmentType: "checkup",
    source: "front_desk",
    status: "confirmed",
    scheduledAt: "2026-09-01T06:00:00.000Z",
    durationMinutes: 40,
    reason: "בדיקה כללית",
    notes: null,
    version: 3,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdByUserId: null,
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    clinicId,
    customerId,
    petId,
    appointmentId: "40000000-0000-4000-8000-000000000001",
    medicalRecordId: "60000000-0000-4000-8000-000000000001",
    status: "in_progress",
    chiefComplaint: "בדיקה כללית",
    manualVisitSummary: null,
    aiVisitSummary: null,
    aiSummaryGeneratedAt: null,
    aiSummaryAcceptedByUserId: null,
    startedAt: "2026-09-01T06:10:00.000Z",
    completedAt: null,
    version: 0,
    createdByUserId: actor.userId,
    createdAt: "2026-09-01T06:10:00.000Z",
    updatedAt: "2026-09-01T06:10:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function medicalRecord(): MedicalRecord {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    clinicId,
    petId,
    summary: null,
    activeProblemList: [],
    alerts: [],
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
    deletedAt: null,
  };
}

function buildService(existing = appointment()) {
  const appointmentRepository = {
    findById: vi.fn().mockResolvedValue(ok(existing)),
    updateVersioned: vi.fn().mockResolvedValue(ok({ ...existing, status: "checked_in", version: existing.version + 1 })),
  };
  const visitRepository = {
    findByAppointment: vi.fn().mockResolvedValue(ok(null)),
    create: vi.fn().mockResolvedValue(ok(visit())),
    openFromAppointment: vi.fn().mockResolvedValue(ok(visit())),
  };
  const medicalRecordService = {
    ensureRecordForPet: vi.fn().mockResolvedValue(ok(medicalRecord())),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok({})) };

  const service = new AppointmentService(
    appointmentRepository as unknown as AppointmentRepository,
    {} as CustomerRepository,
    {} as PetRepository,
    auditService as unknown as AuditService,
    undefined,
    visitRepository as unknown as VisitRepository,
    medicalRecordService as Pick<MedicalRecordService, "ensureRecordForPet">,
  );

  return { service, appointmentRepository, visitRepository, medicalRecordService, auditService };
}

describe("AppointmentService visit workflow", () => {
  it("checks in a scheduled or confirmed appointment", async () => {
    const { service, appointmentRepository } = buildService(appointment({ status: "scheduled" }));

    const result = await service.checkInAppointment(actor, "40000000-0000-4000-8000-000000000001", 3);

    expect(result.ok).toBe(true);
    expect(appointmentRepository.updateVersioned).toHaveBeenCalledWith(
      "40000000-0000-4000-8000-000000000001",
      {
        expectedVersion: 3,
        data: { status: "checked_in", changed_via: "dashboard" },
      },
    );
  });

  it("opens a visit from a checked-in appointment and marks the appointment in_visit", async () => {
    const checkedIn = appointment({ status: "checked_in" });
    const { service, appointmentRepository, visitRepository, medicalRecordService } = buildService(checkedIn);
    appointmentRepository.updateVersioned.mockResolvedValueOnce(ok({ ...checkedIn, status: "in_visit", version: 4 }));

    const result = await service.openVisitFromAppointment(actor, checkedIn.id, checkedIn.version);

    expect(result.ok).toBe(true);
    expect(medicalRecordService.ensureRecordForPet).toHaveBeenCalledWith(actor, { clinicId, petId });
    expect(visitRepository.openFromAppointment).toHaveBeenCalledWith({
      appointmentId: checkedIn.id,
      expectedVersion: checkedIn.version,
      medicalRecordId: "60000000-0000-4000-8000-000000000001",
      chiefComplaint: "בדיקה כללית",
      createdByUserId: actor.userId,
    });
    expect(visitRepository.create).not.toHaveBeenCalled();
    expect(appointmentRepository.updateVersioned).not.toHaveBeenCalled();
  });

  it("does not create a second visit for the same appointment", async () => {
    const checkedIn = appointment({ status: "checked_in" });
    const { service, visitRepository, appointmentRepository } = buildService(checkedIn);
    visitRepository.findByAppointment.mockResolvedValueOnce(ok(visit()));

    const result = await service.openVisitFromAppointment(actor, checkedIn.id, checkedIn.version);

    expect(result.ok).toBe(true);
    expect(visitRepository.create).not.toHaveBeenCalled();
    expect(visitRepository.openFromAppointment).not.toHaveBeenCalled();
    expect(appointmentRepository.updateVersioned).not.toHaveBeenCalled();
  });

  it("returns the visit from the RPC when a concurrent open already created it", async () => {
    const checkedIn = appointment({ status: "checked_in" });
    const { service, visitRepository } = buildService(checkedIn);
    const existingVisit = visit();
    visitRepository.openFromAppointment.mockResolvedValueOnce(ok(existingVisit));

    const result = await service.openVisitFromAppointment(actor, checkedIn.id, checkedIn.version);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(existingVisit.id);
    expect(visitRepository.openFromAppointment).toHaveBeenCalled();
  });
});
