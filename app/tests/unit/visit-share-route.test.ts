import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("POST /api/visits/[visitId]/share", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetActorAndServices.mockReset();
  });

  it("does not trust the request Host header when creating SMS share links", async () => {
    const createAndSend = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        url: "https://clinic.example/s/token",
        shareId: "share-1",
        recipientPhone: "0501234567",
      },
    });
    mockGetActorAndServices.mockResolvedValue({
      actor: { userId: "u1", clinicIds: ["c1"], defaultClinicId: "c1" },
      visitShare: { createAndSend },
    });
    const { POST } = await import("@/app/api/visits/[visitId]/share/route");

    const response = await POST(
      new Request("https://evil.example/api/visits/visit-1/share", {
        method: "POST",
        headers: {
          Host: "evil.example",
          "X-Forwarded-Proto": "https",
        },
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      "visit-1",
    );
    expect(createAndSend.mock.calls[0]?.[2]).toBeUndefined();
  });
});
