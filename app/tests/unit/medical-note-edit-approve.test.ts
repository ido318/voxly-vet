import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Visit } from "@/types/domain/visit";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

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

const outsideActor: ServiceActor = {
  userId: "vet2",
  clinicIds: ["clinic2"],
  defaultClinicId: "clinic2",
  memberships: [{ clinicId: "clinic2", role: "veterinarian" }],
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

function note(overrides: Partial<MedicalNote> = {}): MedicalNote {
  return {
    id: "note1",
    clinicId: "clinic1",
    visitId: "visit1",
    noteType: "general",
    content: "הכלב אוכל היטב",
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    parentNoteId: null,
    status: "draft",
    approvedByUserId: null,
    approvedAt: null,
    version: 1,
    authorUserId: "vet1",
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildService(medicalNoteRepository: Record<string, ReturnType<typeof vi.fn>>) {
  const visitRepository = { findById: vi.fn().mockResolvedValue(ok(visit)) };
  const auditService = { logAction: vi.fn().mockResolvedValue(ok(undefined)) };

  const service = new MedicalRecordService(
    visitRepository as never,
    medicalNoteRepository as never,
    {} as never,
    {} as never,
    {} as never,
    auditService as never,
  );

  return { service, visitRepository, auditService };
}

describe("MedicalRecordService.updateNote", () => {
  it("updates a note after verifying visit access", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note())),
      update: vi.fn().mockResolvedValue(ok(note({ content: "עודכן" }))),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { content: "עודכן" });

    expect(result.ok).toBe(true);
    expect(medicalNoteRepository.update).toHaveBeenCalledWith("note1", { content: "עודכן" });
  });

  it("rejects updates from an actor outside the note's clinic", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note())),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(outsideActor, "note1", { content: "x" });

    expect(result.ok).toBe(false);
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("rejects setting status to approved via plain update", async () => {
    const medicalNoteRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { status: "approved" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(medicalNoteRepository.findById).not.toHaveBeenCalled();
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("rejects setting status to archived via plain update", async () => {
    const medicalNoteRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { status: "archived" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("allows setting status back to draft via plain update", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note())),
      update: vi.fn().mockResolvedValue(ok(note({ status: "draft" }))),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { status: "draft" });

    expect(result.ok).toBe(true);
    expect(medicalNoteRepository.update).toHaveBeenCalledWith("note1", { status: "draft" });
  });

  it("rejects setting noteType to addendum via plain update, even with a parentNoteId (must go through addAddendum instead)", async () => {
    const medicalNoteRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", {
      noteType: "addendum",
      parentNoteId: "parent1",
    } as never);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(medicalNoteRepository.findById).not.toHaveBeenCalled();
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("returns not found when the note's visitId does not match the expected visit", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ visitId: "visit1" }))),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(
      vetActor,
      "note1",
      { content: "x" },
      "some-other-visit",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("succeeds when the note's visitId matches the expected visit", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ visitId: "visit1" }))),
      update: vi.fn().mockResolvedValue(ok(note({ content: "עודכן" }))),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { content: "עודכן" }, "visit1");

    expect(result.ok).toBe(true);
  });

  it("rejects editing an approved note more than 24 hours old with a conflict, before ever calling the repository", async () => {
    const lockedNote = note({
      status: "approved",
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(lockedNote)),
      update: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { content: "עודכן" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
    expect(medicalNoteRepository.update).not.toHaveBeenCalled();
  });

  it("allows editing an approved note less than 24 hours old (not yet locked)", async () => {
    const freshlyApproved = note({
      status: "approved",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    });
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(freshlyApproved)),
      update: vi.fn().mockResolvedValue(ok(note({ content: "עודכן" }))),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.updateNote(vetActor, "note1", { content: "עודכן" });

    expect(result.ok).toBe(true);
    expect(medicalNoteRepository.update).toHaveBeenCalledWith("note1", { content: "עודכן" });
  });
});

describe("MedicalRecordService.addAddendum", () => {
  it("creates a draft addendum note referencing the parent, even when the parent is locked", async () => {
    const lockedParent = note({
      id: "parent1",
      status: "approved",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const createdAddendum = note({
      id: "addendum1",
      noteType: "addendum",
      parentNoteId: "parent1",
      content: "תוספת למרות שההערה נעולה",
      status: "draft",
    });
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(lockedParent)),
      create: vi.fn().mockResolvedValue(ok(createdAddendum)),
    };
    const { service, auditService } = buildService(medicalNoteRepository);

    const result = await service.addAddendum(vetActor, "parent1", {
      content: "תוספת למרות שההערה נעולה",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.noteType).toBe("addendum");
      expect(result.value.parentNoteId).toBe("parent1");
      expect(result.value.status).toBe("draft");
    }
    expect(medicalNoteRepository.create).toHaveBeenCalledWith(
      "clinic1",
      "visit1",
      expect.objectContaining({
        noteType: "addendum",
        parentNoteId: "parent1",
        content: "תוספת למרות שההערה נעולה",
      }),
      "vet1",
    );
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "medical_note.addendum_create",
        entityId: "addendum1",
        metadata: { parentNoteId: "parent1" },
      }),
    );
  });

  it("rejects addendum creation from an actor outside the parent note's clinic", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ id: "parent1" }))),
      create: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.addAddendum(outsideActor, "parent1", { content: "x" });

    expect(result.ok).toBe(false);
    expect(medicalNoteRepository.create).not.toHaveBeenCalled();
  });

  it("returns not found when the parent note's visitId does not match the expected visit", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ id: "parent1", visitId: "visit1" }))),
      create: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.addAddendum(vetActor, "parent1", { content: "x" }, "some-other-visit");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(medicalNoteRepository.create).not.toHaveBeenCalled();
  });

  it("returns not found when the parent note does not exist", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(null)),
      create: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.addAddendum(vetActor, "missing", { content: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(medicalNoteRepository.create).not.toHaveBeenCalled();
  });
});

describe("MedicalRecordService.approveNote", () => {
  it("allows veterinarian to approve a draft note and records reviewer", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note())),
      approve: vi.fn().mockResolvedValue(ok(note({
        status: "approved",
        approvedByUserId: "vet1",
        approvedAt: "2026-09-01T00:00:00.000Z",
      }))),
    };
    const { service, auditService } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "note1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("approved");
      expect(result.value.approvedByUserId).toBe("vet1");
    }
    expect(medicalNoteRepository.approve).toHaveBeenCalledWith("note1", "vet1");
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "medical_note.approve", entityId: "note1" }),
    );
  });

  it("rejects approval from a staff role", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note())),
      approve: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(staffActor, "note1");

    expect(result.ok).toBe(false);
    expect(medicalNoteRepository.approve).not.toHaveBeenCalled();
  });

  it("rejects approving a note that is already approved", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ status: "approved" }))),
      approve: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "note1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
    expect(medicalNoteRepository.approve).not.toHaveBeenCalled();
  });

  it("rejects approving an archived note", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ status: "archived" }))),
      approve: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "note1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
    expect(medicalNoteRepository.approve).not.toHaveBeenCalled();
  });

  it("returns not found when the note does not exist", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(null)),
      approve: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns not found when the note's visitId does not match the expected visit", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ visitId: "visit1" }))),
      approve: vi.fn(),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "note1", "some-other-visit");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(medicalNoteRepository.approve).not.toHaveBeenCalled();
  });

  it("succeeds when the note's visitId matches the expected visit", async () => {
    const medicalNoteRepository = {
      findById: vi.fn().mockResolvedValue(ok(note({ visitId: "visit1" }))),
      approve: vi.fn().mockResolvedValue(ok(note({ status: "approved" }))),
    };
    const { service } = buildService(medicalNoteRepository);

    const result = await service.approveNote(vetActor, "note1", "visit1");

    expect(result.ok).toBe(true);
    expect(medicalNoteRepository.approve).toHaveBeenCalledWith("note1", "vet1");
  });
});

describe("API routes for editing and approving medical notes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("PATCH /api/visits/[visitId]/notes/[noteId] validates the body", async () => {
    const { PATCH } = await import("@/app/api/visits/[visitId]/notes/[noteId]/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { updateNote: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/visits/v1/notes/n1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("PATCH /api/visits/[visitId]/notes/[noteId] calls updateNote and returns 200", async () => {
    const { PATCH } = await import("@/app/api/visits/[visitId]/notes/[noteId]/route");
    const updateNote = vi.fn().mockResolvedValue(ok(note({ content: "עודכן" })));
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { updateNote },
    });

    const response = await PATCH(
      new Request("http://localhost/api/visits/v1/notes/n1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "עודכן" }),
      }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateNote).toHaveBeenCalledWith(
      { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      "n1",
      { content: "עודכן" },
      "v1",
    );
  });

  it("POST /api/visits/[visitId]/notes/[noteId]/approve calls approveNote and returns 200", async () => {
    const { POST } = await import("@/app/api/visits/[visitId]/notes/[noteId]/approve/route");
    const approveNote = vi.fn().mockResolvedValue(ok(note({ status: "approved" })));
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { approveNote },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes/n1/approve", { method: "POST" }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(200);
    expect(approveNote).toHaveBeenCalledWith(
      { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      "n1",
      "v1",
    );
  });

  it("POST /api/visits/[visitId]/notes/[noteId]/approve surfaces a conflict as 409", async () => {
    const { AppError, err } = await import("@/lib/errors/app-error");
    const { POST } = await import("@/app/api/visits/[visitId]/notes/[noteId]/approve/route");
    const approveNote = vi.fn().mockResolvedValue(err(AppError.conflict("Medical note already approved")));
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { approveNote },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes/n1/approve", { method: "POST" }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("POST /api/visits/[visitId]/notes/[noteId]/addendum validates the body", async () => {
    const { POST } = await import("@/app/api/visits/[visitId]/notes/[noteId]/addendum/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { addAddendum: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes/n1/addendum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("POST /api/visits/[visitId]/notes/[noteId]/addendum calls addAddendum and returns 201", async () => {
    const { POST } = await import("@/app/api/visits/[visitId]/notes/[noteId]/addendum/route");
    const addAddendum = vi.fn().mockResolvedValue(
      ok(note({ id: "addendum1", noteType: "addendum", parentNoteId: "n1" })),
    );
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { addAddendum },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes/n1/addendum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "תוספת" }),
      }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(201);
    expect(addAddendum).toHaveBeenCalledWith(
      { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      "n1",
      { content: "תוספת" },
      "v1",
    );
  });

  it("POST /api/visits/[visitId]/notes/[noteId]/addendum surfaces a not-found as 404", async () => {
    const { AppError, err } = await import("@/lib/errors/app-error");
    const { POST } = await import("@/app/api/visits/[visitId]/notes/[noteId]/addendum/route");
    const addAddendum = vi.fn().mockResolvedValue(err(AppError.notFound("Medical note not found")));
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { addAddendum },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes/n1/addendum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "תוספת" }),
      }),
      { params: Promise.resolve({ visitId: "v1", noteId: "n1" }) },
    );

    expect(response.status).toBe(404);
  });
});
