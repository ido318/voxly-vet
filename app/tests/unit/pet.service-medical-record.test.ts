import { describe, expect, it, vi } from "vitest";
import { PetService } from "@/lib/services/pet.service";

const actor = {
  userId: "user1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "admin" as const }],
};

const pet = {
  id: "pet1",
  clinicId: "clinic1",
  customerId: "customer1",
  name: "Mika",
  species: "dog",
  breed: null,
  sex: null,
  birthDate: null,
  weight: null,
  chipNumber: null,
  isNeutered: false,
  allergies: null,
  chronicConditions: null,
  currentMedications: null,
  notes: null,
  profileImageUrl: null,
  status: "active" as const,
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
  deletedAt: null,
};

describe("PetService medical record alignment", () => {
  it("ensures every newly created pet has a medical record", async () => {
    const petRepository = {
      insert: vi.fn().mockResolvedValue({ ok: true, value: pet }),
    };
    const customerRepository = {
      findById: vi.fn().mockResolvedValue({
        ok: true,
        value: { id: "customer1", clinicId: "clinic1" },
      }),
    };
    const auditService = {
      logAction: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    };
    const medicalRecordService = {
      ensureRecordForPet: vi.fn().mockResolvedValue({
        ok: true,
        value: { id: "mr1", clinicId: "clinic1", petId: "pet1" },
      }),
    };
    const service = new PetService(
      petRepository as never,
      customerRepository as never,
      auditService as never,
      medicalRecordService as never,
    );

    const result = await service.createPet(actor, {
      clinicId: "clinic1",
      customerId: "customer1",
      name: "Mika",
      species: "dog",
    });

    expect(result.ok).toBe(true);
    expect(medicalRecordService.ensureRecordForPet).toHaveBeenCalledWith(actor, {
      clinicId: "clinic1",
      petId: "pet1",
    });
  });
});
