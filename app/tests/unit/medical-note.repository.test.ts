import { describe, expect, it, vi } from "vitest";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";

function buildClientForUpdate(error: unknown, data: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const is = vi.fn().mockReturnValue({ select });
  const eq = vi.fn().mockReturnValue({ is });
  const update = vi.fn().mockReturnValue({ eq });
  const client = { from: vi.fn().mockReturnValue({ update }) };
  return { client, update };
}

describe("MedicalNoteRepository.update", () => {
  it("maps the lock trigger's P0001 error (with its matching message) to a 409 conflict, not a 502", async () => {
    const { client } = buildClientForUpdate({
      code: "P0001",
      message: "medical note is locked: approved more than 24 hours ago",
    });
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.update("note1", { content: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.status).toBe(409);
    }
  });

  it("maps an error carrying only the lock message (no P0001 code) to a conflict too", async () => {
    const { client } = buildClientForUpdate({
      code: "23505",
      message: "medical note is locked: approved more than 24 hours ago",
    });
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.update("note1", { content: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("does NOT map a bare P0001 error with an unrelated message to a conflict (avoids mislabeling a future unrelated trigger)", async () => {
    const { client } = buildClientForUpdate({
      code: "P0001",
      message: "some other trigger raised an unrelated exception",
    });
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.update("note1", { content: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTERNAL_PROVIDER_ERROR");
      expect(result.error.status).toBe(502);
    }
  });

  it("still surfaces unrelated errors as a generic external-provider (502) error", async () => {
    const { client } = buildClientForUpdate({
      code: "23503",
      message: "some unrelated foreign key violation",
    });
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.update("note1", { content: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTERNAL_PROVIDER_ERROR");
      expect(result.error.status).toBe(502);
    }
  });

  it("succeeds and maps the row when there is no error", async () => {
    const row = {
      id: "note1",
      clinic_id: "clinic1",
      visit_id: "visit1",
      note_type: "general",
      content: "x",
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      parent_note_id: null,
      status: "draft",
      approved_by_user_id: null,
      approved_at: null,
      version: 1,
      author_user_id: "vet1",
      created_at: "2026-08-31T09:00:00.000Z",
      updated_at: "2026-08-31T09:00:00.000Z",
      deleted_at: null,
    };
    const { client } = buildClientForUpdate(null, row);
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.update("note1", { content: "x" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("note1");
    }
  });
});

describe("MedicalNoteRepository.create", () => {
  it("threads parentNoteId through to the insert payload as parent_note_id", async () => {
    const row = {
      id: "note2",
      clinic_id: "clinic1",
      visit_id: "visit1",
      note_type: "addendum",
      content: "addendum content",
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      parent_note_id: "note1",
      status: "draft",
      approved_by_user_id: null,
      approved_at: null,
      version: 1,
      author_user_id: "vet1",
      created_at: "2026-09-01T09:00:00.000Z",
      updated_at: "2026-09-01T09:00:00.000Z",
      deleted_at: null,
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.create(
      "clinic1",
      "visit1",
      { noteType: "addendum", content: "addendum content", parentNoteId: "note1" },
      "vet1",
    );

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_note_id: "note1", note_type: "addendum" }),
    );
    if (result.ok) {
      expect(result.value.parentNoteId).toBe("note1");
    }
  });

  it("always writes status 'draft' to the insert payload, even if a status is smuggled into the input (CreateMedicalNoteInput has no status field, so this cast simulates a caller bypassing that type)", async () => {
    const row = {
      id: "note3",
      clinic_id: "clinic1",
      visit_id: "visit1",
      note_type: "general",
      content: "x",
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      parent_note_id: null,
      status: "draft",
      approved_by_user_id: null,
      approved_at: null,
      version: 1,
      author_user_id: "vet1",
      created_at: "2026-09-02T09:00:00.000Z",
      updated_at: "2026-09-02T09:00:00.000Z",
      deleted_at: null,
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const repository = new MedicalNoteRepository(client as never);

    const result = await repository.create(
      "clinic1",
      "visit1",
      { noteType: "general", content: "x", status: "approved" } as never,
      "vet1",
    );

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }));
    if (result.ok) {
      expect(result.value.status).toBe("draft");
    }
  });
});
