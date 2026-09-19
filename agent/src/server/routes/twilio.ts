import { Hono } from "hono";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getEnv } from "../../lib/env.js";
import { logger, maskPhone } from "../../lib/logger.js";
import { saveIncomingVoiceCall } from "../../lib/store.js";
import { twilioValidate } from "../middleware/twilioValidate.js";

export const twilioRoutes = new Hono();

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Singleton — avoid creating a new HTTP client on every call
let _elevenlabs: ElevenLabsClient | null = null;
function getElevenLabs(): ElevenLabsClient {
  if (!_elevenlabs) {
    _elevenlabs = new ElevenLabsClient({ apiKey: getEnv().ELEVENLABS_API_KEY });
  }
  return _elevenlabs;
}

/**
 * POST /twilio/voice
 *
 * Called by Twilio when a call arrives. Returns TwiML that connects the caller
 * to the ElevenLabs agent via a signed Media Stream WebSocket URL.
 *
 * NOTE: This route is only active when Twilio's webhook points here.
 * In the current production setup, ElevenLabs Native Integration manages the
 * webhook directly and this route is NOT called. It is kept as a fallback for
 * when manual webhook control is needed (e.g. passing dynamic variables).
 */
twilioRoutes.post("/twilio/voice", twilioValidate, async (c) => {
  const env = getEnv();
  const body = await c.req.parseBody();
  const callerPhone =
    typeof body["From"] === "string" ? body["From"] : "unknown";
  const toNumber =
    typeof body["To"] === "string" ? body["To"] : env.TWILIO_PHONE_NUMBER;
  const callSid =
    typeof body["CallSid"] === "string" ? body["CallSid"] : `unknown-${Date.now()}`;

  logger.info({ caller: maskPhone(callerPhone), callSid }, "twilio: incoming call");

  try {
    await saveIncomingVoiceCall({
      twilioCallSid: callSid,
      fromNumber: callerPhone,
      toNumber,
      status: "in_progress",
      metadata: Object.fromEntries(
        Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    });
  } catch (err) {
    logger.error({ err, callSid }, "twilio: failed to create live voice call record");
  }

  // Play the disclaimer first, then redirect to a second webhook that fetches
  // a FRESH ElevenLabs signed URL right before connecting the media stream.
  // (Generating the signed URL up front and only using it after the
  // disclaimer finishes playing was causing it to expire.)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="he-IL" voice="Google.he-IL-Wavenet-A">שיחתך מיד תענה. שימו לב כי השיחות מוקלטות לצורך בקרה ואיכות השירות.</Say>
  <Redirect method="POST">/twilio/voice-connect</Redirect>
</Response>`;

  logger.info({ caller: maskPhone(callerPhone) }, "twilio: returning disclaimer + redirect");
  return c.text(twiml, 200, { "Content-Type": "text/xml" });
});

twilioRoutes.post("/twilio/voice-connect", twilioValidate, async (c) => {
  const env = getEnv();
  const body = await c.req.parseBody();
  const callerPhone =
    typeof body["From"] === "string" ? body["From"] : "unknown";
  const callSid =
    typeof body["CallSid"] === "string" ? body["CallSid"] : `unknown-${Date.now()}`;

  let signed_url: string;
  try {
    const result = await getElevenLabs().conversationalAi.conversations.getSignedUrl({
      agentId: env.ELEVENLABS_AGENT_ID,
    });
    signed_url = result.signedUrl;
  } catch (err) {
    logger.error({ err }, "twilio: failed to get ElevenLabs signed URL");
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="he-IL" voice="Google.he-IL-Wavenet-A">מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר.</Say></Response>`,
      500,
      { "Content-Type": "text/xml" },
    );
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXmlAttr(signed_url)}">
      <Parameter name="caller_number" value="${escapeXmlAttr(callerPhone)}"/>
      <Parameter name="twilio_call_sid" value="${escapeXmlAttr(callSid)}"/>
    </Stream>
  </Connect>
</Response>`;

  logger.info({ caller: maskPhone(callerPhone) }, "twilio: returning ElevenLabs TwiML");
  return c.text(twiml, 200, { "Content-Type": "text/xml" });
});

/**
 * POST /twilio/status
 *
 * Twilio calls this with call status updates (initiated, ringing, in-progress,
 * completed, etc.). We log the transition for observability; the authoritative
 * call record is written by /hooks/call-ended (ElevenLabs post-call webhook).
 */
twilioRoutes.post("/twilio/status", twilioValidate, async (c) => {
  const body = await c.req.parseBody();
  logger.info(
    {
      callSid: body["CallSid"],
      callStatus: body["CallStatus"],
      caller: maskPhone(typeof body["From"] === "string" ? body["From"] : ""),
    },
    "twilio: call status update",
  );
  return c.body(null, 204);
});
