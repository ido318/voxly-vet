import { Hono } from "hono";
import { getEnv } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { verifyElevenLabsSignature } from "../../lib/elevenLabsAuth.js";
import { saveVoiceCall } from "../../lib/store.js";
import { classifyCallCategory } from "../../lib/callClassifier.js";
import { getSupabase } from "../../lib/supabase.js";
import { logConversation } from "../../lib/learning/logConversation.js";
import { analyzeCallQuality } from "../../lib/learning/qaAnalyzer.js";

export const hooksRoutes = new Hono();

// POST /hooks/call-ended
// Receives ElevenLabs post_call_transcription webhook.
// Payload shape mirrors GetConversationResponseModel:
//   conversation_id, transcript[], analysis.transcript_summary,
//   metadata.call_duration_secs, status, has_audio
hooksRoutes.post("/hooks/call-ended", async (c) => {
  const env = getEnv();
  const rawBody = await c.req.text();
  const sigHeader = c.req.header("elevenlabs-signature") ?? "";

  if (!verifyElevenLabsSignature(rawBody, sigHeader, env.ELEVENLABS_WEBHOOK_SECRET)) {
    logger.warn("hooks: call-ended signature invalid");
    return c.json({ error: "invalid_signature" }, 401);
  }

  let eventPayload: Record<string, unknown>;
  try {
    eventPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const payload = getConversationPayload(eventPayload);

  const conversationId =
    (payload["conversation_id"] as string | undefined) ?? `unknown-${Date.now()}`;

  // duration: prefer metadata.call_duration_secs (ElevenLabs standard), fallback to legacy fields
  const meta = payload["metadata"] as Record<string, unknown> | undefined;
  const rawDuration =
    (meta?.["call_duration_secs"] as number | undefined) ??
    (payload["duration_seconds"] as number | undefined) ??
    (payload["duration"] as number | undefined) ??
    null;
  const durationSec = typeof rawDuration === "number" ? rawDuration : null;

  const success =
    typeof payload["success"] === "boolean" ? payload["success"] : null;

  // Extract transcript (array of { role, message, time_in_call_secs })
  const rawTranscript = payload["transcript"];
  const transcript = Array.isArray(rawTranscript) ? rawTranscript : null;

  // Extract AI summary from analysis object
  const analysis = payload["analysis"] as Record<string, unknown> | undefined;
  const aiSummary =
    typeof analysis?.["transcript_summary"] === "string"
      ? analysis["transcript_summary"]
      : null;

  // Classify the call
  const callCategory = classifyCallCategory(payload);

  logger.info({ conversationId, durationSec, success, callCategory }, "hook: call ended");

  // Save to DB first (fast path).
  //
  // Best-effort: a throw here used to escape the handler and return 500 to
  // ElevenLabs, which then retries the whole webhook — so a transient Supabase
  // error turned into repeated delivery, and the recording upload and
  // prompt-learning work below never ran at all for that call. Losing one
  // voice_calls row is recoverable from the transcript ElevenLabs keeps;
  // losing the recording is not.
  try {
    await saveVoiceCall(conversationId, durationSec, success, payload, {
      transcript,
      aiSummary,
      callCategory,
    });
  } catch (err: unknown) {
    logger.error(
      { errMsg: err instanceof Error ? err.message : String(err), conversationId },
      "hook: saveVoiceCall failed — continuing so the recording is not lost",
    );
  }

  // Prompt learning loop: log evaluation-criteria results, then run per-call QA
  // scoring (fire-and-forget; non-blocking). Chained, not parallel — analyzeCallQuality
  // updates the same call_reviews row logConversation creates, and needs it to exist first.
  void logConversation(conversationId, env.AGENT_CLINIC_ID, payload)
    .then(() => analyzeCallQuality(conversationId, payload))
    .catch((err: unknown) =>
      logger.error(
        { errMsg: err instanceof Error ? err.message : String(err), conversationId },
        "hook: prompt-learning-loop logging failed",
      ),
    );

  // Fetch and store recording asynchronously (fire-and-forget; failure is non-blocking)
  const hasAudio = payload["has_audio"] === true;
  if (hasAudio) {
    void fetchAndStoreRecording(conversationId, env.ELEVENLABS_API_KEY, env.AGENT_CLINIC_ID).catch(
      (err: unknown) => logger.error(
        { errMsg: err instanceof Error ? err.message : String(err), conversationId },
        "hook: recording upload failed",
      ),
    );
  }

  return c.json({ ok: true });
});

function getConversationPayload(eventPayload: Record<string, unknown>): Record<string, unknown> {
  const data = eventPayload["data"];
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : eventPayload;
}

async function fetchAndStoreRecording(
  conversationId: string,
  apiKey: string,
  clinicId: string,
): Promise<void> {
  // GET /v1/convai/conversations/{conversation_id}/audio — returns binary MP3
  const audioRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!audioRes.ok) {
    logger.warn(
      { conversationId, status: audioRes.status },
      "hook: ElevenLabs audio fetch failed",
    );
    return;
  }

  let audioBuffer: ArrayBuffer;
  try {
    audioBuffer = await audioRes.arrayBuffer();
  } catch (err) {
    logger.warn(
      { conversationId, errMsg: err instanceof Error ? err.message : String(err) },
      "hook: failed to read audio response body",
    );
    return;
  }
  const storagePath = `${clinicId}/${conversationId}.mp3`;

  const { error } = await getSupabase()
    .storage
    .from("call-recordings")
    .upload(storagePath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    logger.warn({ conversationId, error: error.message }, "hook: Storage upload failed");
    return;
  }

  // Update the recording_storage_path on the voice_call row
  const { error: updateErr } = await getSupabase()
    .from("voice_calls")
    .update({ recording_storage_path: storagePath })
    .eq("elevenlabs_conversation_id", conversationId);

  if (updateErr) {
    logger.warn(
      { conversationId, error: updateErr.message },
      "hook: recording_storage_path update failed",
    );
  } else {
    logger.info({ conversationId, storagePath }, "hook: recording stored");
  }
}
