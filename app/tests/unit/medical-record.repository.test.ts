import { describe, expect, it, vi } from "vitest";
import { MedicalRecordRepository } from "@/lib/repositories/medical-record.repository";

describe("MedicalRecordRepository", () => {
  it("creates a medical record for a pet when none exists", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "mr1",
        clinic_id: "clinic1",
        pet_id: "pet1",
        summary: null,
        active_problem_list: [],
        alerts: [],
        created_at: "2026-08-31T10:00:00.000Z",
        updated_at: "2026-08-31T10:00:00.000Z",
        deleted_at: null,
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const repository = new MedicalRecordRepository(client as never);

    const result = await repository.createForPet("clinic1", "pet1");

    expect(result.ok).toBe(true);
    expect(client.from).toHaveBeenCalledWith("medical_records");
    expect(insert).toHaveBeenCalledWith({ clinic_id: "clinic1", pet_id: "pet1" });
    if (result.ok) {
      expect(result.value).toMatchObject({
        id: "mr1",
        clinicId: "clinic1",
        petId: "pet1",
        activeProblemList: [],
        alerts: [],
      });
    }
  });
});
