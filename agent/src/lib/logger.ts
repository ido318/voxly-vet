import pino, { type Logger } from "pino";
import { getEnv } from "./env.js";

const env = getEnv();

const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined;

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  transport,
  base: undefined, // omit pid/hostname noise
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.OPENAI_API_KEY",
      "*.TWILIO_AUTH_TOKEN",
    ],
    censor: "[REDACTED]",
  },
});

/** Mask a phone number to last 4 digits for logs. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-${digits.slice(-4)}`;
}
