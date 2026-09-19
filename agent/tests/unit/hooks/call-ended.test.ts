import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { hooksRoutes } from "../../../src/server/routes/hooks.js";

const { mockSaveVoiceCall, mockUpload, mockUpdate, mockEq, mockLogConversation, mockAnalyzeCallQuality } = vi.hoisted(() => ({
  mockSaveVoiceCall: vi.fn().mockResolvedValue(undefined),
  mockUpload: vi.fn().mockResolvedValue({ error: null }),
  mockEq: vi.fn().mockResolvedValue({ error: null }),
  mockUpdate: vi.fn(() => ({ eq: mockEq })),
  mockLogConversation: vi.fn().mockResolvedValue(undefined),
  mockAnalyzeCallQuality: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return { ...actual, saveVoiceCall: mockSaveVoiceCall };
});

vi.mock("../../../src/lib/learning/logConversation.js", () => ({
  logConversation: mockLogConversation,
}));

vi.mock("../../../src/lib/learning/qaAnalyzer.js", () => ({
  analyzeCallQuality: mockAnalyzeCallQuality,
}));

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
      })),
    },
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  })),
}));

// SECRET must match ELEVENLABS_WEBHOOK_SECRET set in tests/setup.ts
const SECRET = "test-secret";

function sign(body: string, timestamp = String(Math.floor(Date.now() / 1000))): string {
  const sig = createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v0=${sig}`;
}

function makeApp() {
  const app = new Hono();
  app.route("/", hooksRoutes);
  return app;
}

const payload = JSON.stringify({
  conversation_id: "conv_test123",
  duration_seconds: 45,
  success: true,
  has_audio: false,
});

describe("POST /hooks/call-ended", () => {
  beforeEach(() => {
    mockSaveVoiceCall.mockClear();
    mockUpload.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockLogConversation.mockClear();
    mockLogConversation.mockResolvedValue(undefined);
    mockAnalyzeCallQuality.mockClear();
    mockAnalyzeCallQuality.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 200 with valid signature and writes to DB", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(mockSaveVoiceCall).toHaveBeenCalledOnce();
  });

  it("passes transcript and AI summary enrichment to saveVoiceCall", async () => {
    const enrichedPayload = JSON.stringify({
      conversation_id: "conv_with_transcript",
      success: true,
      has_audio: false,
      transcript: [{ role: "user", message: "אני רוצה לקבוע תור", time_in_call_secs: 3 }],
      analysis: { transcript_summary: "הלקוחה ביקשה לקבוע תור." },
    });

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(enrichedPayload),
      },
      body: enrichedPayload,
    });

    expect(res.status).toBe(200);
    expect(mockSaveVoiceCall).toHaveBeenCalledWith(
      "conv_with_transcript",
      null,
      true,
      expect.any(Object),
      expect.objectContaining({
        transcript: [{ role: "user", message: "אני רוצה לקבוע תור", time_in_call_secs: 3 }],
        aiSummary: "הלקוחה ביקשה לקבוע תור.",
      }),
    );
  });

  it("unwraps ElevenLabs post_call_transcription event payloads", async () => {
    const wrappedPayload = JSON.stringify({
      type: "post_call_transcription",
      event_timestamp: 1781945581,
      data: {
        conversation_id: "conv_wrapped",
        status: "done",
        has_audio: false,
        transcript: [{ role: "user", message: "אני צריך תור", time_in_call_secs: 2 }],
        metadata: { call_duration_secs: 33 },
        analysis: { transcript_summary: "נקבע תור דרך תומר." },
      },
    });

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(wrappedPayload),
      },
      body: wrappedPayload,
    });

    expect(res.status).toBe(200);
    expect(mockSaveVoiceCall).toHaveBeenCalledWith(
      "conv_wrapped",
      33,
      null,
      expect.objectContaining({
        conversation_id: "conv_wrapped",
        status: "done",
      }),
      expect.objectContaining({
        transcript: [{ role: "user", message: "אני צריך תור", time_in_call_secs: 2 }],
        aiSummary: "נקבע תור דרך תומר.",
      }),
    );
  });

  it("fetches and stores recording when ElevenLabs reports audio is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      }),
    );

    const recordingPayload = JSON.stringify({
      conversation_id: "conv_with_audio",
      success: true,
      has_audio: true,
    });

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(recordingPayload),
      },
      body: recordingPayload,
    });

    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockUpload).toHaveBeenCalledOnce();
    });
    expect(mockUpload.mock.calls[0]?.[0]).toBe(
      "00000000-0000-4000-8000-000000000001/conv_with_audio.mp3",
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      recording_storage_path: "00000000-0000-4000-8000-000000000001/conv_with_audio.mp3",
    });
    expect(mockEq).toHaveBeenCalledWith("elevenlabs_conversation_id", "conv_with_audio");
  });

  it("calls logConversation fire-and-forget after saving the voice call", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockLogConversation).toHaveBeenCalledWith(
        "conv_test123",
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  it("calls analyzeCallQuality after logConversation resolves", async () => {
    const callOrder: string[] = [];
    mockLogConversation.mockImplementation(async () => {
      callOrder.push("logConversation");
    });
    mockAnalyzeCallQuality.mockImplementation(async () => {
      callOrder.push("analyzeCallQuality");
    });

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockAnalyzeCallQuality).toHaveBeenCalledWith("conv_test123", expect.any(Object));
    });
    expect(callOrder).toEqual(["logConversation", "analyzeCallQuality"]);
  });

  it("a logConversation failure does not fail the webhook response", async () => {
    mockLogConversation.mockRejectedValueOnce(new Error("call_reviews upsert failed"));

    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": sign(payload),
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(mockAnalyzeCallQuality).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong signature — no DB write", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": "t=1234567890,v0=badhash",
      },
      body: payload,
    });
    expect(res.status).toBe(401);
    expect(mockSaveVoiceCall).not.toHaveBeenCalled();
  });

  it("returns 401 with missing signature header — no DB write", async () => {
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(401);
    expect(mockSaveVoiceCall).not.toHaveBeenCalled();
  });

  it("returns 401 with valid HMAC but stale timestamp (>5 min old) — no DB write", async () => {
    // Timestamp 601 seconds in the past — outside the 300-second tolerance window
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 601);
    const staleSig = sign(payload, staleTimestamp);
    const res = await makeApp().request("/hooks/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "elevenlabs-signature": staleSig,
      },
      body: payload,
    });
    expect(res.status).toBe(401);
    expect(mockSaveVoiceCall).not.toHaveBeenCalled();
  });
});
