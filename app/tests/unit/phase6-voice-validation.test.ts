import { describe, expect, it } from "vitest";
import { listVoiceCallsSchema, twilioVoiceWebhookSchema } from "@/lib/validators/voice-call";

describe("phase6 voice validation", () => {
  it("validates list voice calls query", () => {
    const parsed = listVoiceCallsSchema.parse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      status: "completed",
      limit: "25",
      offset: "0",
    });
    expect(parsed.limit).toBe(25);
    expect(parsed.status).toBe("completed");
  });

  it("rejects invalid voice call status filter", () => {
    expect(() =>
      listVoiceCallsSchema.parse({ status: "unknown" }),
    ).toThrow();
  });

  it("validates Twilio webhook payload", () => {
    const parsed = twilioVoiceWebhookSchema.parse({
      CallSid: "CA123",
      From: "+972501234567",
      To: "+972359012345",
      CallStatus: "ringing",
      Digits: "1",
    });
    expect(parsed.Digits).toBe("1");
  });

  it("requires CallSid, From, and To", () => {
    expect(() =>
      twilioVoiceWebhookSchema.parse({ CallSid: "CA123" }),
    ).toThrow();
  });
});
