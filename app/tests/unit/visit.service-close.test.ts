import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { VisitService } from "@/lib/services/visit.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Visit } from "@/types/domain/visit";

const actor: ServiceActor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" }],
};

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "visit1",
    clinicId: "clinic1",
    customerId: "customer1",
    petId: "pet1",
    appointmentId: null,
    medicalRecordId: "mr1",
    status: "in_progress",
    chiefComplaint: "צליעה",
    manualVisitSummary: null,
    aiVisitSummary: null,
    aiSummaryGeneratedAt: null,
    aiSummaryAcceptedByUserId: null,
    startedAt: "2026-08-31T09:00:00.000Z",
    completedAt: null,
    version: 2,
    createdByUserId: "user1",
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildService(existing = visit(), notes: unknown[] = [{ id: "note1" }]) {
  const visitRepository = {
    findById: vi.fn().mockResolvedValue(ok(existing)),
    updateVersioned: vi.fn().mockResolvedValue(ok({ ...existing, status: "completed", version: existing.version + 1 })),
  };
  const medicalRecordService = {
    listNotes: vi.fn().mockResolvedValue(ok(notes)),
  };
  const followUpService = {
    createFromVisitClose: vi.fn().mockResolvedValue(ok({ id: "follow1" })),
  };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok(undefined)) };
  const service = new VisitService(
    visitRepository as unknown as VisitRepository,
    {} as CustomerRepository,
    {} as PetRepository,
    {} as AppointmentRepository,
    auditService as unknown as AuditService,
    medicalRecordService as unknown as Pick<MedicalRecordService, "ensureRecordForPet" | "listNotes">,
    followUpService as never,
  );

  return { service, visitRepository, followUpService };
}

describe("VisitService.closeVisit", () => {
  it("requires a visit reason before closing", async () => {
    const { service, visitRepository } = buildService(visit({ chiefComplaint: null }));

    const result = await service.closeVisit(actor, "visit1", 2);

    expect(result.ok).toBe(false);
    expect(visitRepository.updateVersioned).not.toHaveBeenCalled();
  });

  it("requires at least one clinical note before closing", async () => {
    const { service, visitRepository } = buildService(visit(), []);

    const result = await service.closeVisit(actor, "visit1", 2);

    expect(result.ok).toBe(false);
    expect(visitRepository.updateVersioned).not.toHaveBeenCalled();
  });

  it("closes a visit with reason and notes", async () => {
    const { service, visitRepository } = buildService();

    const result = await service.closeVisit(actor, "visit1", 2);

    expect(result.ok).toBe(true);
    expect(visitRepository.updateVersioned).toHaveBeenCalledWith("visit1", {
      expectedVersion: 2,
      data: expect.objectContaining({ status: "completed" }),
    });
  });

  it("creates a follow-up when requested during close", async () => {
    const { service, followUpService } = buildService();

    const result = await service.closeVisit(actor, "visit1", 2, {
      reason: "בדיקת שיפור",
      dueAt: "2026-09-01T09:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(followUpService.createFromVisitClose).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ id: "visit1", status: "completed" }),
      { reason: "בדיקת שיפור", dueAt: "2026-09-01T09:00:00.000Z" },
    );
  });
});
