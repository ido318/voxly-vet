import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { mockGetSignedUrl, mockSaveIncomingVoiceCall } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn(),
  mockSaveIncomingVoiceCall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: vi.fn(function ElevenLabsClient() {
    return {
    conversationalAi: {
      conversations: {
        getSignedUrl: mockGetSignedUrl,
      },
    },
    };
  }),
}));

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    saveIncomingVoiceCall: mockSaveIncomingVoiceCall,
  };
});

import { twilioRoutes } from "../../../src/server/routes/twilio.js";

function makeApp() {
  const app = new Hono();
  app.route("/", twilioRoutes);
  return app;
}

describe("POST /twilio/voice live call tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue({
      signedUrl: "wss://elevenlabs.test/stream?token=a&mode=voice",
    });
  });

  it("creates an in-progress voice call and returns the disclaimer + redirect", async () => {
    const body = new URLSearchParams({
      CallSid: "CA1234567890",
      From: "+972541234567",
      To: "+972500000002",
    });

    const res = await makeApp().request("/twilio/voice", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    expect(res.status).toBe(200);
    expect(mockSaveIncomingVoiceCall).toHaveBeenCalledWith({
      twilioCallSid: "CA1234567890",
      fromNumber: "+972541234567",
      toNumber: "+972500000002",
      status: "in_progress",
      metadata: {
        CallSid: "CA1234567890",
        From: "+972541234567",
        To: "+972500000002",
      },
    });

    const xml = await res.text();
    expect(xml).toContain("<Say");
    expect(xml).toContain('<Redirect method="POST">/twilio/voice-connect</Redirect>');
  });

  it("returns the Connect/Stream TwiML with caller params from /twilio/voice-connect", async () => {
    const body = new URLSearchParams({
      CallSid: "CA1234567890",
      From: "+972541234567",
      To: "+972500000002",
    });

    const res = await makeApp().request("/twilio/voice-connect", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    expect(res.status).toBe(200);
    expect(mockGetSignedUrl).toHaveBeenCalled();

    const xml = await res.text();
    expect(xml).toContain('name="caller_number" value="+972541234567"');
    expect(xml).toContain('name="twilio_call_sid" value="CA1234567890"');
  });
});
