import { NextResponse } from "next/server";

// This DTMF-menu status webhook is no longer active.
// Voice call status is now tracked via /hooks/call-ended in agent/src/server/routes/hooks.ts.
// Original implementation archived at docs/archive/twilio-voice-webhook.service.ts
export async function POST() {
  return NextResponse.json(
    { error: "not_active", message: "Voice call status handled by ElevenLabs agent hook" },
    { status: 410 },
  );
}
