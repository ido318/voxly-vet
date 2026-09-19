import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase6 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("GET /api/voice/calls returns 400 on invalid status", async () => {
    const { GET } = await import("@/app/api/voice/calls/route");
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      voiceCall: { listCalls: vi.fn() },
    });

    const response = await GET(
      new Request("http://localhost/api/voice/calls?status=invalid"),
    );
    expect(response.status).toBe(400);
  });

  it("GET /api/voice/calls/[callId] delegates to service", async () => {
    const { GET } = await import("@/app/api/voice/calls/[callId]/route");
    const getCallById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "call-1", clinicId: "c1" },
    });
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      voiceCall: { getCallById },
    });

    const response = await GET(new Request("http://localhost/api/voice/calls/call-1"), {
      params: Promise.resolve({ callId: "call-1" }),
    });
    expect(response.status).toBe(200);
    expect(getCallById).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      "call-1",
    );
  });
});
