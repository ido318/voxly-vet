import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase4 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("POST /api/visits returns 400 on invalid payload", async () => {
    const { POST } = await import("@/app/api/visits/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      visit: { createVisit: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("GET /api/pets/[petId]/vaccinations requires clinicId", async () => {
    const { GET } = await import("@/app/api/pets/[petId]/vaccinations/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { listPetVaccinations: vi.fn() },
    });

    const response = await GET(
      new Request("http://localhost/api/pets/p1/vaccinations"),
      { params: Promise.resolve({ petId: "p1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/visits/[visitId]/notes validates content", async () => {
    const { POST } = await import("@/app/api/visits/[visitId]/notes/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      medicalRecord: { addNote: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteType: "general", content: "" }),
      }),
      { params: Promise.resolve({ visitId: "v1" }) },
    );
    expect(response.status).toBe(400);
  });
});
