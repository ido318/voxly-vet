import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mockGetActorAndServices = vi.fn();
vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

const mockDownload = vi.fn();
const mockFrom = vi.fn(() => ({ download: mockDownload }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: mockFrom } }),
}));

const mockTranscribeAudio = vi.fn();
vi.mock("@/lib/ai/soap-note/provider", () => ({
  createOpenAiSoapNoteProvider: () => ({ transcribeAudio: mockTranscribeAudio }),
  createStubSoapNoteProvider: () => ({ transcribeAudio: mockTranscribeAudio }),
}));

const actor = { userId: "u1", clinicIds: ["clinic-1"], defaultClinicId: "clinic-1" };

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/visits/visit-1/soap-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/visits/[visitId]/soap-draft", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
    mockDownload.mockReset();
    mockFrom.mockClear();
    mockTranscribeAudio.mockReset();
  });

  it("transcribes the recording, generates the artifact with sourceId = visitId, and returns subjective/objective/assessment/plan", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    const generateArtifact = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: "artifact-1",
        structuredPayload: {
          subjective: "S",
          objective: "O",
          assessment: "A",
          plan: "P",
        },
      },
    });
    mockGetActorAndServices.mockResolvedValue({
      actor,
      visit: { getVisitById },
      aiArtifact: { generateArtifact },
    });

    const audioBlob = new Blob([new Uint8Array([1, 2, 3])]);
    mockDownload.mockResolvedValue({ data: audioBlob, error: null });
    mockTranscribeAudio.mockResolvedValue({
      transcriptText: "התמלול של הביקור",
      modelName: "stub",
    });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-draft/route");

    const storagePath = "clinic-1/visit-1/some-uuid.webm";
    const response = await POST(jsonRequest({ storagePath }), {
      params: Promise.resolve({ visitId: "visit-1" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({
      id: "artifact-1",
      structuredPayload: {
        subjective: "S",
        objective: "O",
        assessment: "A",
        plan: "P",
      },
      transcriptText: "התמלול של הביקור",
    });

    expect(mockFrom).toHaveBeenCalledWith("soap-recordings");
    expect(mockDownload).toHaveBeenCalledWith(storagePath);
    expect(mockTranscribeAudio).toHaveBeenCalledWith(expect.any(Uint8Array), "audio/webm");

    // sourceId must always be the visit's id, since that's what the service
    // uses to rate-limit generation per (sourceId, "soap_note_generated").
    expect(generateArtifact).toHaveBeenCalledWith(actor, "draft_soap", {
      clinicId: "clinic-1",
      sourceType: "visit",
      sourceId: "visit-1",
      sourceText: "התמלול של הביקור",
    });
  });

  it("rejects a cross-clinic storagePath before downloading anything", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    const generateArtifact = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor,
      visit: { getVisitById },
      aiArtifact: { generateArtifact },
    });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-draft/route");

    const response = await POST(
      jsonRequest({ storagePath: "someone-elses-clinic/visit-9/some-uuid.webm" }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(generateArtifact).not.toHaveBeenCalled();
  });

  it("rejects a storagePath for a different visit within the same accessible clinic, before downloading anything", async () => {
    // Regression guard: actor.clinicIds includes "clinic-1" and the
    // requested path's clinic segment is also "clinic-1", so a check that
    // only tested clinic membership (rather than matching THIS visit
    // exactly) would incorrectly allow this — letting a multi-clinic staff
    // member attach a recording from a different visit's folder.
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    const generateArtifact = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor,
      visit: { getVisitById },
      aiArtifact: { generateArtifact },
    });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-draft/route");

    const response = await POST(
      jsonRequest({ storagePath: "clinic-1/visit-999/some-uuid.webm" }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(generateArtifact).not.toHaveBeenCalled();
  });

  it("propagates a generateArtifact rate-limit failure as a structured error, not a crash", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    const generateArtifact = vi.fn().mockResolvedValue({
      ok: false,
      error: AppError.validation(
        "SOAP draft generation rate limit reached (5 per hour for this source)",
      ),
    });
    mockGetActorAndServices.mockResolvedValue({
      actor,
      visit: { getVisitById },
      aiArtifact: { generateArtifact },
    });

    const audioBlob = new Blob([new Uint8Array([1, 2, 3])]);
    mockDownload.mockResolvedValue({ data: audioBlob, error: null });
    mockTranscribeAudio.mockResolvedValue({
      transcriptText: "התמלול של הביקור",
      modelName: "stub",
    });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-draft/route");

    const response = await POST(
      jsonRequest({ storagePath: "clinic-1/visit-1/some-uuid.webm" }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/rate limit/);
  });

  it("propagates a transcription failure as a clean external-provider error, not a generic 500", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    const generateArtifact = vi.fn();
    mockGetActorAndServices.mockResolvedValue({
      actor,
      visit: { getVisitById },
      aiArtifact: { generateArtifact },
    });

    const audioBlob = new Blob([new Uint8Array([1, 2, 3])]);
    mockDownload.mockResolvedValue({ data: audioBlob, error: null });
    mockTranscribeAudio.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));

    const { POST } = await import("@/app/api/visits/[visitId]/soap-draft/route");

    const response = await POST(
      jsonRequest({ storagePath: "clinic-1/visit-1/some-uuid.webm" }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    // Matches AiArtifactService.generateSoapDraft's own handling of its
    // parseTranscript failure one function away: caught, not swallowed,
    // and turned into a clean 502 external-provider error rather than an
    // opaque 500.
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("EXTERNAL_PROVIDER_ERROR");
    expect(generateArtifact).not.toHaveBeenCalled();
  });
});
