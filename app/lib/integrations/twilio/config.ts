/** Default seeded clinic when TWILIO maps to single-clinic MVP */
export const DEFAULT_VOICE_CLINIC_ID = "00000000-0000-4000-8000-000000000001";

export type TwilioVoiceConfig = {
  accountSid: string;
  authToken: string;
  clinicPhoneNumber: string;
  clinicId: string;
  baseUrl: string;
};

export function getTwilioVoiceConfig(): TwilioVoiceConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const clinicPhoneNumber = process.env.TWILIO_CLINIC_PHONE_NUMBER?.trim();
  // Deliberately the raw variable, not env.ts's VERCEL_URL fallback: these become
  // webhook URLs Twilio calls back on, so they must point at a stable deployment.
  // Absent it, voice config stays null and the integration is simply inactive.
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!accountSid || !authToken || !clinicPhoneNumber || !baseUrl) {
    return null;
  }

  return {
    accountSid,
    authToken,
    clinicPhoneNumber,
    clinicId: process.env.TWILIO_CLINIC_ID?.trim() || DEFAULT_VOICE_CLINIC_ID,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

export function voiceWebhookUrl(path: string): string {
  const config = getTwilioVoiceConfig();
  if (!config) return path;
  return `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export type TwilioSmsConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

/**
 * Credentials for sending an SMS. Deliberately separate from the voice config:
 * sending a message needs no webhook URL, so requiring APP_BASE_URL (as the voice
 * config must) would disable SMS on any deployment that only sets VERCEL_URL.
 *
 * The from-number is accepted under either name. app/ introduced
 * TWILIO_CLINIC_PHONE_NUMBER while agent/ has always used TWILIO_PHONE_NUMBER for
 * the same Twilio number, and an environment configured from the agent's list
 * would otherwise leave SMS silently unavailable here.
 */
export function getTwilioSmsConfig(): TwilioSmsConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber =
    process.env.TWILIO_CLINIC_PHONE_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) return null;

  return { accountSid, authToken, fromNumber };
}

/** Names the variables that are missing, so the UI can say what to set. */
export function missingTwilioSmsEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) missing.push("TWILIO_ACCOUNT_SID");
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) missing.push("TWILIO_AUTH_TOKEN");
  if (
    !process.env.TWILIO_CLINIC_PHONE_NUMBER?.trim() &&
    !process.env.TWILIO_PHONE_NUMBER?.trim()
  ) {
    missing.push("TWILIO_CLINIC_PHONE_NUMBER (או TWILIO_PHONE_NUMBER)");
  }
  return missing;
}
