import twilio from "twilio";
import { getEnv } from "./env.js";
import { normalisePhone } from "./store.js";

let _client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!_client) {
    const env = getEnv();
    _client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return _client;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const env = getEnv();
  const normalisedTo = normalisePhone(to);
  // Twilio rejects an unusable number with "Invalid 'To' Phone Number" and
  // bills nothing, but the notification row is already claimed by then and
  // lands in `failed` with no way to retry. Fail here instead, where the
  // processor can record a cause that names the real problem.
  if (!normalisedTo) {
    throw new Error(`sendSms: ${JSON.stringify(to)} is not a valid Israeli phone number`);
  }
  const message = await getTwilioClient().messages.create({
    body,
    from: env.TWILIO_PHONE_NUMBER,
    to: normalisedTo,
  });
  return { sid: message.sid };
}
