import { NextResponse } from "next/server";

// This DTMF-menu voice route is no longer active.
// Voice calls are now handled by the ElevenLabs agent (Tomer) via agent/src/server/routes/twilio.ts.
// Original implementation archived at docs/archive/twilio-voice-webhook.service.ts
export async function POST() {
  return NextResponse.json(
    { error: "not_active", message: "Voice calls handled by ElevenLabs agent" },
    { status: 410 },
  );
}
