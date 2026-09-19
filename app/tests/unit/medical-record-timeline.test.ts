import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { LabOrderRepository } from "@/lib/repositories/lab-order.repository";
import type { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import type { MedicalRecordRepository } from "@/lib/repositories/medical-record.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import type { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { VitalRepository } from "@/lib/repositories/vital.repository";
import type { AuditService } from "@/lib/services/audit.service";

const actor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" as const }],
};

function buildService() {
  const visitRepository = {
    list: vi.fn().mockResolvedValue(ok([
      {
        id: "visit1",
        clinicId: "clinic1",
        customerId: "customer1",
        petId: "pet1",
        appointmentId: null,
        medicalRecordId: "mr1",
        status: "completed",
        chiefComplaint: "צליעה",
        manualVisitSummary: null,
        aiVisitSummary: null,
        aiSummaryGeneratedAt: null,
        aiSummaryAcceptedByUserId: null,
        startedAt: "2026-08-30T09:00:00.000Z",
        completedAt: null,
        version: 0,
        createdByUserId: "user1",
        createdAt: "2026-08-30T09:00:00.000Z",
        updatedAt: "2026-08-30T09:00:00.000Z",
        deletedAt: null,
      },
    ])),
  };
  const medicalNoteRepository = {
    listByPet: vi.fn().mockResolvedValue(ok([
      {
        id: "note1",
        clinicId: "clinic1",
        visitId: "visit1",
        noteType: "soap_assessment",
        content: "חשד לנקע",
        subjective: null,
        objective: null,
        assessment: "נקע",
        plan: null,
        status: "approved",
        approvedByUserId: "user1",
        approvedAt: "2026-08-30T09:10:00.000Z",
        version: 0,
        authorUserId: "user1",
        createdAt: "2026-08-30T09:10:00.000Z",
        updatedAt: "2026-08-30T09:10:00.000Z",
        deletedAt: null,
      },
    ])),
  };
  const vaccinationRepository = { listByPet: vi.fn().mockResolvedValue(ok([])) };
  const prescriptionRepository = { listByPet: vi.fn().mockResolvedValue(ok([])) };
  const vitalRepository = {
    listByPet: vi.fn().mockResolvedValue(ok([
      {
        id: "vital1",
        clinicId: "clinic1",
        customerId: "customer1",
        petId: "pet1",
        visitId: "visit1",
        recordedAt: "2026-08-30T09:20:00.000Z",
        weightKg: 12.5,
        temperatureC: 38.4,
        heartRateBpm: null,
        respiratoryRateBpm: null,
        mucousMembrane: null,
        capillaryRefillTime: null,
        bodyConditionScore: null,
        painScore: null,
        hydrationStatus: null,
        notes: null,
        recordedByUserId: "user1",
        version: 0,
        createdAt: "2026-08-30T09:20:00.000Z",
        updatedAt: "2026-08-30T09:20:00.000Z",
        deletedAt: null,
      },
    ])),
  };
  const labOrderRepository = { list: vi.fn().mockResolvedValue(ok([])) };
  const petRepository = {
    findById: vi.fn().mockResolvedValue(ok({ id: "pet1", clinicId: "clinic1" })),
  };

  const service = new MedicalRecordService(
    visitRepository as unknown as VisitRepository,
    medicalNoteRepository as unknown as MedicalNoteRepository,
    vaccinationRepository as unknown as VaccinationRepository,
    prescriptionRepository as unknown as PrescriptionRepository,
    petRepository as unknown as PetRepository,
    {} as AuditService,
    {} as MedicalRecordRepository,
    vitalRepository as unknown as VitalRepository,
    labOrderRepository as unknown as LabOrderRepository,
  );

  return { service };
}

describe("MedicalRecordService timeline", () => {
  it("combines record entries in reverse chronological order", async () => {
    const { service } = buildService();

    const result = await service.getTimeline(actor, "pet1", {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.type)).toEqual(["vital", "medical_note", "visit"]);
    expect(result.value.items.at(0)?.sourceHref).toBe("/dashboard/visits/visit1");
  });

  it("filters and searches timeline entries", async () => {
    const { service } = buildService();

    const result = await service.getTimeline(actor, "pet1", {
      type: "medical_note",
      q: "נקע",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]).toMatchObject({ type: "medical_note", title: "SOAP - הערכה" });
  });
});
