import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mockGetActorAndServices = vi.fn();
vi.mock("@/lib/api/actor", () => ({
  getActorAndServices: () => mockGetActorAndServices(),
}));

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: mockFrom } }),
}));

const actor = { userId: "u1", clinicIds: ["clinic-1"], defaultClinicId: "clinic-1" };

function okVisit(getVisitById = vi.fn().mockResolvedValue({
  ok: true,
  value: { id: "visit-1", clinicId: "clinic-1" },
})) {
  return { getVisitById };
}

describe("POST /api/visits/[visitId]/soap-recording", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
    mockUpload.mockReset();
    mockCreateSignedUrl.mockReset();
    mockFrom.mockClear();
  });

  it("uploads via the admin client and returns the derived storagePath", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: true,
      value: { id: "visit-1", clinicId: "clinic-1" },
    });
    mockGetActorAndServices.mockResolvedValue({ actor, visit: { getVisitById } });
    mockUpload.mockResolvedValue({ error: null });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "recording.webm", { type: "audio/webm" }),
    );

    const response = await POST(
      new Request("http://localhost/api/visits/visit-1/soap-recording", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.storagePath).toMatch(
      /^clinic-1\/visit-1\/[0-9a-f-]{36}\.webm$/,
    );

    // Uploaded through the admin/service-role client, not a user-session client.
    expect(mockFrom).toHaveBeenCalledWith("soap-recordings");
    expect(mockUpload).toHaveBeenCalledWith(
      body.data.storagePath,
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "audio/webm" }),
    );
    // The clinicId used in the path comes from the verified visit, not a
    // client-supplied value.
    expect(getVisitById).toHaveBeenCalledWith(actor, "visit-1");
  });

  it("rejects when no file field is present, without touching Storage", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const response = await POST(
      new Request("http://localhost/api/visits/visit-1/soap-recording", {
        method: "POST",
        body: new FormData(),
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects a non-audio file, without touching Storage", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "not-audio.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/visits/visit-1/soap-recording", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("returns a 400 validation error (not a generic 500) when the body isn't valid multipart", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const response = await POST(
      new Request("http://localhost/api/visits/visit-1/soap-recording", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=broken" },
        body: "this is not a valid multipart body",
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("propagates a visit-authorization failure without ever calling Storage", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: false,
      error: AppError.forbidden("Visit outside actor clinics"),
    });
    mockGetActorAndServices.mockResolvedValue({ actor, visit: { getVisitById } });

    const { POST } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "recording.webm", { type: "audio/webm" }),
    );

    const response = await POST(
      new Request("http://localhost/api/visits/visit-1/soap-recording", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe("GET /api/visits/[visitId]/soap-recording", () => {
  beforeEach(() => {
    mockGetActorAndServices.mockReset();
    mockUpload.mockReset();
    mockCreateSignedUrl.mockReset();
    mockFrom.mockClear();
  });

  it("returns a signed URL for a storagePath matching this visit exactly", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/audio.webm" },
      error: null,
    });

    const { GET } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const path = "clinic-1/visit-1/some-uuid.webm";
    const response = await GET(
      new Request(
        `http://localhost/api/visits/visit-1/soap-recording?path=${encodeURIComponent(path)}`,
      ),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      url: "https://signed.example/audio.webm",
      expiresIn: 60 * 60,
    });
    expect(mockFrom).toHaveBeenCalledWith("soap-recordings");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(path, 60 * 60);
  });

  it("rejects a cross-clinic storagePath before calling Storage", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { GET } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const path = "someone-elses-clinic/visit-9/some-uuid.webm";
    const response = await GET(
      new Request(
        `http://localhost/api/visits/visit-1/soap-recording?path=${encodeURIComponent(path)}`,
      ),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a storagePath for a different visit within the same accessible clinic, before calling Storage", async () => {
    // Regression guard: actor.clinicIds includes "clinic-1" and the
    // requested path's clinic segment is also "clinic-1", so a check that
    // only tested clinic membership would incorrectly allow this. The path
    // must match THIS visit's id too.
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { GET } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const path = "clinic-1/visit-999/some-uuid.webm";
    const response = await GET(
      new Request(
        `http://localhost/api/visits/visit-1/soap-recording?path=${encodeURIComponent(path)}`,
      ),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects when the path query parameter is missing", async () => {
    mockGetActorAndServices.mockResolvedValue({ actor, visit: okVisit() });

    const { GET } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const response = await GET(
      new Request("http://localhost/api/visits/visit-1/soap-recording"),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("propagates a visit-authorization failure without ever calling Storage", async () => {
    const getVisitById = vi.fn().mockResolvedValue({
      ok: false,
      error: AppError.forbidden("Visit outside actor clinics"),
    });
    mockGetActorAndServices.mockResolvedValue({ actor, visit: { getVisitById } });

    const { GET } = await import("@/app/api/visits/[visitId]/soap-recording/route");

    const path = "clinic-1/visit-1/some-uuid.webm";
    const response = await GET(
      new Request(
        `http://localhost/api/visits/visit-1/soap-recording?path=${encodeURIComponent(path)}`,
      ),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
