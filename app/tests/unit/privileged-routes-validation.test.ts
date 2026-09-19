import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

const ownerActor = {
  userId: "u1",
  clinicIds: ["c1"],
  defaultClinicId: "c1",
  memberships: [{ clinicId: "c1", role: "owner" }],
};

describe("privileged API route validation", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetActorAndServices.mockReset();
  });

  it("POST approve pending appointment returns 400 on invalid payload", async () => {
    const approvePendingAppointment = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: ownerActor,
      appointment: { approvePendingAppointment },
    });
    const { POST } = await import("@/app/api/appointments/[appointmentId]/approve/route");

    const response = await POST(
      new Request("http://localhost/api/appointments/appt-1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "" }),
      }),
      { params: Promise.resolve({ appointmentId: "appt-1" }) },
    );

    expect(response.status).toBe(400);
    expect(approvePendingAppointment).not.toHaveBeenCalled();
  });

  it("POST reject pending appointment returns 400 on invalid payload", async () => {
    const rejectPendingAppointment = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: ownerActor,
      appointment: { rejectPendingAppointment },
    });
    const { POST } = await import("@/app/api/appointments/[appointmentId]/reject/route");

    const response = await POST(
      new Request("http://localhost/api/appointments/appt-1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "" }),
      }),
      { params: Promise.resolve({ appointmentId: "appt-1" }) },
    );

    expect(response.status).toBe(400);
    expect(rejectPendingAppointment).not.toHaveBeenCalled();
  });

  it("PATCH escalation resolve returns 400 on invalid payload", async () => {
    const resolve = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: ownerActor,
      escalation: { resolve },
    });
    const { PATCH } = await import("@/app/api/escalations/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/escalations/esc-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "x".repeat(2001) }),
      }),
      { params: Promise.resolve({ id: "esc-1" }) },
    );

    expect(response.status).toBe(400);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("GET escalations returns 400 on invalid status filter", async () => {
    const listForClinics = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor: ownerActor,
      escalation: { listForClinics },
    });
    const { GET } = await import("@/app/api/escalations/route");

    const response = await GET(
      new Request("http://localhost/api/escalations?status=invalid"),
    );

    expect(response.status).toBe(400);
    expect(listForClinics).not.toHaveBeenCalled();
  });
});
