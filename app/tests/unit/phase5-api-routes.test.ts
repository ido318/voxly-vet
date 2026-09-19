import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mockGetActorAndServices = vi.fn();

vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

describe("phase5 API routes", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
  });

  it("POST accept validates summaryText", async () => {
    const { POST } = await import(
      "@/app/api/visits/[visitId]/ai-summary/accept/route"
    );
    mockGetActorAndServices.mockResolvedValue({
      actor: {
        userId: "u1",
        clinicIds: ["c1"],
        defaultClinicId: "c1",
        memberships: [{ clinicId: "c1", role: "owner" }],
      },
      visitSummaryAssistant: { acceptDraft: vi.fn() },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/ai-summary/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 0, summaryText: "" }),
      }),
      { params: Promise.resolve({ visitId: "v1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("POST generate delegates to service", async () => {
    const { POST } = await import(
      "@/app/api/visits/[visitId]/ai-summary/generate/route"
    );
    const generateDraft = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        draftText: "Draft",
        modelName: "stub",
        aiEventId: "e1",
      },
    });
    mockGetActorAndServices.mockResolvedValue({
      actor: {
        userId: "u1",
        clinicIds: ["c1"],
        defaultClinicId: "c1",
        memberships: [{ clinicId: "c1", role: "veterinarian" }],
      },
      visitSummaryAssistant: { generateDraft },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/ai-summary/generate", {
        method: "POST",
      }),
      { params: Promise.resolve({ visitId: "v1" }) },
    );

    expect(response.status).toBe(200);
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      "v1",
    );
  });

  it("POST accept returns 409 on stale version", async () => {
    const { POST } = await import(
      "@/app/api/visits/[visitId]/ai-summary/accept/route"
    );
    mockGetActorAndServices.mockResolvedValue({
      actor: {
        userId: "u1",
        clinicIds: ["c1"],
        defaultClinicId: "c1",
        memberships: [{ clinicId: "c1", role: "owner" }],
      },
      visitSummaryAssistant: {
        acceptDraft: vi.fn().mockResolvedValue({
          ok: false,
          error: AppError.conflict("Visit update conflict: stale version"),
        }),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/ai-summary/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 0, summaryText: "Accepted summary" }),
      }),
      { params: Promise.resolve({ visitId: "v1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("POST generate returns generic message without provider details", async () => {
    const { POST } = await import(
      "@/app/api/visits/[visitId]/ai-summary/generate/route"
    );
    mockGetActorAndServices.mockResolvedValue({
      actor: {
        userId: "u1",
        clinicIds: ["c1"],
        defaultClinicId: "c1",
        memberships: [{ clinicId: "c1", role: "owner" }],
      },
      visitSummaryAssistant: {
        generateDraft: vi.fn().mockResolvedValue({
          ok: false,
          error: AppError.externalProvider(
            "יצירת סיכום הביקור נכשלה. נסה שוב מאוחר יותר.",
          ),
        }),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/visits/v1/ai-summary/generate", {
        method: "POST",
      }),
      { params: Promise.resolve({ visitId: "v1" }) },
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as {
      error?: { message?: string; details?: unknown };
    };
    expect(body.error?.message).toBe(
      "יצירת סיכום הביקור נכשלה. נסה שוב מאוחר יותר.",
    );
    expect(body.error?.details).toBeUndefined();
  });
});
