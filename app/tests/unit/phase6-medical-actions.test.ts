import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { LabOrderService } from "@/lib/services/lab-order.service";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { LabOrderRepository } from "@/lib/repositories/lab-order.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit } from "@/types/domain/visit";

const vetActor: ServiceActor = {
  userId: "vet1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" }],
};

const staffActor: ServiceActor = {
  ...vetActor,
  memberships: [{ clinicId: "clinic1", role: "staff" }],
};

const prescription: Prescription = {
  id: "rx1",
  clinicId: "clinic1",
  visitId: "visit1",
  petId: "pet1",
  medicationName: "מוקסיפן",
  instructions: "פעמיים ביום",
  status: "draft",
  discontinuedAt: null,
  prescribedAt: "2026-08-31T09:00:00.000Z",
  prescribedByUserId: "vet1",
  notes: null,
  createdAt: "2026-08-31T09:00:00.000Z",
  updatedAt: "2026-08-31T09:00:00.000Z",
  deletedAt: null,
};

const vaccination: Vaccination = {
  id: "vaccination1",
  clinicId: "clinic1",
  customerId: "customer1",
  petId: "pet1",
  visitId: "visit1",
  vaccineName: "כלבת",
  administeredAt: "2026-08-31T09:00:00.000Z",
  batchNumber: null,
  nextDueAt: "2027-08-31",
  notes: null,
  administeredByUserId: "vet1",
  createdAt: "2026-08-31T09:00:00.000Z",
  updatedAt: "2026-08-31T09:00:00.000Z",
  deletedAt: null,
};

const visit: Visit = {
  id: "visit1",
  clinicId: "clinic1",
  customerId: "customer1",
  petId: "pet1",
  appointmentId: null,
  medicalRecordId: "record1",
  status: "in_progress",
  chiefComplaint: "חיסון",
  manualVisitSummary: null,
  aiVisitSummary: null,
  aiSummaryGeneratedAt: null,
  aiSummaryAcceptedByUserId: null,
  startedAt: "2026-08-31T09:00:00.000Z",
  completedAt: null,
  version: 1,
  createdByUserId: "vet1",
  createdAt: "2026-08-31T09:00:00.000Z",
  updatedAt: "2026-08-31T09:00:00.000Z",
  deletedAt: null,
};

function buildMedicalRecordService() {
  const visitRepository = { findById: vi.fn().mockResolvedValue(ok(visit)) };
  const medicalNoteRepository = {};
  const vaccinationRepository = {
    create: vi.fn().mockResolvedValue(ok(vaccination)),
  };
  const prescriptionRepository = {
    findById: vi.fn().mockResolvedValue(ok(prescription)),
    update: vi.fn().mockResolvedValue(ok({ ...prescription, status: "active" })),
  };
  const petRepository = {
    findById: vi.fn().mockResolvedValue(ok({
      id: "pet1",
      clinicId: "clinic1",
      customerId: "customer1",
      name: "לונה",
    })),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok(undefined)) };
  const customerRepository = {
    findById: vi.fn().mockResolvedValue(ok({
      id: "customer1",
      fullName: "דנה",
      phone: "+972501234567",
    })),
  };
  const dashboardNotifications = {
    enqueueVaccinationReminder: vi.fn().mockResolvedValue(ok(undefined)),
  };

  const service = new MedicalRecordService(
    visitRepository as never,
    medicalNoteRepository as never,
    vaccinationRepository as never,
    prescriptionRepository as never,
    petRepository as never,
    auditService as never,
    {} as never,
    undefined,
    undefined,
    customerRepository as never,
    dashboardNotifications as never,
  );

  return { service, prescriptionRepository, vaccinationRepository, dashboardNotifications };
}

describe("Phase 6 medical actions", () => {
  it("allows veterinarian/admin role to approve a prescription draft", async () => {
    const { service, prescriptionRepository } = buildMedicalRecordService();

    const result = await service.approvePrescription(vetActor, "rx1");

    expect(result.ok).toBe(true);
    expect(prescriptionRepository.update).toHaveBeenCalledWith("rx1", {
      status: "active",
      discontinuedAt: null,
    });
  });

  it("rejects prescription approval for staff role", async () => {
    const { service, prescriptionRepository } = buildMedicalRecordService();

    const result = await service.approvePrescription(staffActor, "rx1");

    expect(result.ok).toBe(false);
    expect(prescriptionRepository.update).not.toHaveBeenCalled();
  });

  it("enqueues a vaccination reminder when next due date is recorded", async () => {
    const { service, dashboardNotifications } = buildMedicalRecordService();

    const result = await service.recordVaccination(vetActor, "pet1", {
      clinicId: "clinic1",
      customerId: "customer1",
      vaccineName: "כלבת",
      administeredAt: "2026-08-31T09:00:00.000Z",
      visitId: "visit1",
      nextDueAt: "2027-08-31",
    });

    expect(result.ok).toBe(true);
    expect(dashboardNotifications.enqueueVaccinationReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        vaccinationId: "vaccination1",
        phone: "+972501234567",
        petName: "לונה",
        nextDueAt: "2027-08-31",
      }),
    );
  });

  it("requires lab result text before completing a lab order", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok({
        id: "lab1",
        clinicId: "clinic1",
        status: "in_progress",
        resultText: null,
      })),
      updateVersioned: vi.fn(),
    };
    const service = new LabOrderService(repository as unknown as LabOrderRepository);

    const result = await service.updateLabOrder(vetActor, "lab1", 1, { status: "completed" });

    expect(result.ok).toBe(false);
    expect(repository.updateVersioned).not.toHaveBeenCalled();
  });
});
