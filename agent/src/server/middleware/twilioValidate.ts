import { createMiddleware } from "hono/factory";
import twilio from "twilio";
import { getEnv } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

export const twilioValidate = createMiddleware(async (c, next) => {
  const env = getEnv();

  if (!env.TWILIO_VALIDATE_SIGNATURE) {
    await next();
    return;
  }

  const signature = c.req.header("x-twilio-signature") ?? "";
  const url = `${env.PUBLIC_BASE_URL}${c.req.path}`;
  const rawBody = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawBody)) {
    if (typeof v === "string") params[k] = v;
  }

  const valid = twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);

  if (!valid) {
    logger.warn({ path: c.req.path }, "twilio signature validation failed");
    return c.json({ error: "forbidden" }, 403);
  }

  await next();
});
