import { normaliseIsraeliPhone } from "@tomer/shared";
import { AppError } from "@/lib/errors/app-error";
import { getTwilioSmsConfig, missingTwilioSmsEnvVars } from "@/lib/integrations/twilio/config";

/**
 * Convert an Israeli phone string to E.164 (+972...), or null when it cannot
 * be one. Delegates to @tomer/shared — this was a near-copy of the agent's
 * normalisePhone, and both ended with `return "+" + digits`, so junk input
 * produced the string "+" and Twilio answered "Invalid 'To' Phone Number".
 */
export function toE164Israel(raw: string): string | null {
  return normaliseIsraeliPhone(raw);
}

export type SendSmsResult = { sid: string | null };

/**
 * Send an SMS via the Twilio REST API using the clinic's configured credentials.
 * Throws an AppError naming the missing variables when SMS is not configured, or
 * wrapping Twilio's own error when the request fails.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const config = getTwilioSmsConfig();
  if (!config) {
    // Name the missing variables: "not configured" alone sent us looking at
    // Twilio itself when the cause was an unset env var on the deployment.
    throw AppError.serviceUnavailable(
      `שליחת SMS אינה מוגדרת — חסרים משתני סביבה: ${missingTwilioSmsEnvVars().join(", ")}`,
    );
  }

  const recipient = toE164Israel(to);
  if (!recipient) {
    // Twilio would answer "Invalid 'To' Phone Number" — a provider error for
    // what is really bad data on our side. Say so plainly instead.
    throw AppError.validation(`מספר הטלפון ${to} אינו מספר ישראלי תקין — לא נשלח SMS`);
  }

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const params = new URLSearchParams({
    To: recipient,
    From: config.fromNumber,
    Body: body,
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
  } catch (error) {
    throw AppError.externalProvider("Failed to reach Twilio", error);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw AppError.externalProvider(`Twilio SMS send failed (${response.status})`, detail);
  }

  const payload = (await response.json().catch(() => ({}))) as { sid?: string };
  return { sid: payload.sid ?? null };
}
