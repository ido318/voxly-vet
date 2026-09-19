import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, mockUpdate, mockEq, mockSelect, mockUpsert } = vi.hoisted(() => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const mockSelect = vi.fn((...args: unknown[]) => {
    calls.push({ method: "select", args });
    return Promise.resolve({ data: [{ id: "row-1" }], error: null });
  });
  const mockEq = vi.fn((...args: unknown[]) => {
    calls.push({ method: "eq", args });
    return { select: mockSelect };
  });
  const mockUpdate = vi.fn((...args: unknown[]) => {
    calls.push({ method: "update", args });
    return { eq: mockEq };
  });
  const mockUpsert = vi.fn((...args: unknown[]) => {
    calls.push({ method: "upsert", args });
    return Promise.resolve({ error: null });
  });
  return { calls, mockUpdate, mockEq, mockSelect, mockUpsert };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate,
      upsert: mockUpsert,
    })),
  })),
}));

import { extractCallerPhone, saveVoiceCall } from "../../../src/lib/store.js";

describe("saveVoiceCall", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("updates the live Twilio row when the ElevenLabs webhook carries twilio_call_sid", async () => {
    await saveVoiceCall(
      "conv_123",
      45,
      true,
      {
        caller_number: "+972541234567",
        twilio_call_sid: "CA1234567890",
      },
      {
        transcript: [{ role: "user", message: "שלום" }],
        aiSummary: "נקבע תור",
        callCategory: "operation",
      },
    );

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_123",
      status: "completed",
      duration_seconds: 45,
      from_number: "+972541234567",
      transcript: [{ role: "user", message: "שלום" }],
      ai_summary: "נקבע תור",
      call_category: "operation",
    });
    expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty("ended_at");
    expect(mockEq).toHaveBeenCalledWith("twilio_call_sid", "CA1234567890");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("falls back to upsert by conversation id when no row matches twilio_call_sid", async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    await saveVoiceCall(
      "conv_456",
      30,
      true,
      {
        caller_number: "+972541234567",
        twilio_call_sid: "CA_stale_sid",
      },
      {},
    );

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_456",
      status: "completed",
    });
  });

  it("marks ElevenLabs done webhook payloads as completed", async () => {
    await saveVoiceCall(
      "conv_done",
      12,
      null,
      {
        caller_number: "+972541234567",
        status: "done",
      },
      {
        transcript: [{ role: "user", message: "בדיקה" }],
        aiSummary: "השיחה הסתיימה",
        callCategory: "information",
      },
    );

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_done",
      status: "completed",
      duration_seconds: 12,
      transcript: [{ role: "user", message: "בדיקה" }],
      ai_summary: "השיחה הסתיימה",
      call_category: "information",
    });
    expect(mockUpsert.mock.calls[0]?.[0]).toHaveProperty("ended_at");
  });
});

describe("extractCallerPhone", () => {
  it("reads caller_number from a native ElevenLabs inbound payload (dynamic_variables)", () => {
    const payload = {
      type: "post_call_transcription",
      conversation_id: "conv_native_el",
      metadata: {
        call_duration_secs: 42,
      },
      conversation_initiation_client_data: {
        dynamic_variables: {
          system__caller_id: "+972509876543",
          system__called_number: "+972500000000",
          system__call_sid: "CAnativeinbound",
        },
      },
    };

    expect(extractCallerPhone(payload)).toBe("+972509876543");
  });
});

describe("saveVoiceCall native ElevenLabs inbound fixture", () => {
  it("stores from_number from system__caller_id when caller_number is absent", async () => {
    await saveVoiceCall(
      "conv_native_el",
      42,
      true,
      {
        conversation_initiation_client_data: {
          dynamic_variables: {
            system__caller_id: "+972509876543",
            twilio_call_sid: "CAnativeinbound",
          },
        },
      },
      {},
    );

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
      elevenlabs_conversation_id: "conv_native_el",
      from_number: "+972509876543",
      status: "completed",
    });
    expect(mockEq).toHaveBeenCalledWith("twilio_call_sid", "CAnativeinbound");
  });
});
