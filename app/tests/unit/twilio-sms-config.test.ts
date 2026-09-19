import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTwilioSmsConfig, missingTwilioSmsEnvVars } from "@/lib/integrations/twilio/config";

/**
 * SMS used to borrow the voice integration's config, which also demands
 * APP_BASE_URL (a webhook concern) and only ever read TWILIO_CLINIC_PHONE_NUMBER.
 * On a deployment configured from agent/'s variable list that left every SMS
 * feature silently unavailable.
 */

const KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_CLINIC_PHONE_NUMBER",
  "TWILIO_PHONE_NUMBER",
  "APP_BASE_URL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("getTwilioSmsConfig", () => {
  it("resolves without APP_BASE_URL, which SMS does not need", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_CLINIC_PHONE_NUMBER = "+972500000000";

    expect(getTwilioSmsConfig()).toEqual({
      accountSid: "AC123",
      authToken: "token",
      fromNumber: "+972500000000",
    });
  });

  it("accepts the agent's TWILIO_PHONE_NUMBER as the from-number", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+972511111111";

    expect(getTwilioSmsConfig()?.fromNumber).toBe("+972511111111");
  });

  it("prefers TWILIO_CLINIC_PHONE_NUMBER when both names are set", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_CLINIC_PHONE_NUMBER = "+972500000000";
    process.env.TWILIO_PHONE_NUMBER = "+972511111111";

    expect(getTwilioSmsConfig()?.fromNumber).toBe("+972500000000");
  });

  it("returns null and names what is missing", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";

    expect(getTwilioSmsConfig()).toBeNull();
    expect(missingTwilioSmsEnvVars()).toEqual([
      "TWILIO_AUTH_TOKEN",
      "TWILIO_CLINIC_PHONE_NUMBER (או TWILIO_PHONE_NUMBER)",
    ]);
  });

  it("treats a whitespace-only value as unset", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_CLINIC_PHONE_NUMBER = "   ";

    expect(getTwilioSmsConfig()).toBeNull();
  });
});
