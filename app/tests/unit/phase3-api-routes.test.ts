import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase3 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("POST /api/appointments returns 400 on invalid payload", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      appointment: { createAppointment: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("DELETE /api/appointments/[appointmentId] returns 400 when version is missing", async () => {
    const { DELETE } = await import("@/app/api/appointments/[appointmentId]/route");
    const softDelete = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      appointment: { softDelete },
    });

    const response = await DELETE(
      new Request("http://localhost/api/appointments/appt-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appointmentId: "appt-1" }) },
    );

    expect(response.status).toBe(400);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it("GET /api/calendar/availability validates required query params", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      calendar: { availabilityByDate: vi.fn() },
    });

    const response = await GET(new Request("http://localhost/api/calendar/availability"));
    expect(response.status).toBe(400);
  });

  it("GET /api/calendar returns 400 on invalid view", async () => {
    const { GET } = await import("@/app/api/calendar/route");
    const listDay = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: {
        userId: "u1",
        clinicIds: ["00000000-0000-4000-8000-000000000001"],
        defaultClinicId: "00000000-0000-4000-8000-000000000001",
      },
      calendar: { listDay, listWeek: vi.fn() },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/calendar?clinicId=00000000-0000-4000-8000-000000000001&date=2026-06-21&view=month",
      ),
    );

    expect(response.status).toBe(400);
    expect(listDay).not.toHaveBeenCalled();
  });
});
