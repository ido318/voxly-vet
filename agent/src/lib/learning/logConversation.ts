import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";

type EvaluationCriterionResult = {
  result?: "success" | "failure" | "unknown";
  rationale?: string;
};

/**
 * Reads an already-parsed /hooks/call-ended payload (mirrors ElevenLabs'
 * GetConversationResponseModel) and logs it to call_reviews. Never throws — a
 * failure here must not affect the webhook response (call the site with `.catch()`).
 */
export async function logConversation(
  conversationId: string,
  clinicId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const analysis = payload["analysis"] as Record<string, unknown> | undefined;
  const metadata = payload["metadata"] as Record<string, unknown> | undefined;

  const evaluationResults =
    (analysis?.["evaluation_criteria_results"] as
      | Record<string, EvaluationCriterionResult>
      | undefined) ?? {};

  const flaggedReasons = Object.entries(evaluationResults)
    .filter(([, criterion]) => criterion.result === "failure")
    .map(([criteriaId]) => criteriaId);

  const agentId =
    (payload["agent_id"] as string | undefined) ?? getEnv().ELEVENLABS_AGENT_ID;
  const versionId = (payload["version_id"] as string | undefined) ?? null;
  const callSuccessful = (analysis?.["call_successful"] as string | undefined) ?? null;
  const transcriptSummary = (analysis?.["transcript_summary"] as string | undefined) ?? null;
  const dataCollectionResults = analysis?.["data_collection_results"] ?? {};
  const transcript = Array.isArray(payload["transcript"]) ? payload["transcript"] : [];
  const callDurationSecs = (metadata?.["call_duration_secs"] as number | undefined) ?? null;

  const { error } = await getSupabase().from("call_reviews").upsert(
    {
      clinic_id: clinicId,
      conversation_id: conversationId,
      agent_id: agentId,
      version_id: versionId,
      call_successful: callSuccessful,
      transcript_summary: transcriptSummary,
      evaluation_criteria_results: evaluationResults,
      data_collection_results: dataCollectionResults,
      transcript,
      call_duration_secs: callDurationSecs,
      flagged: flaggedReasons.length > 0,
      flagged_reasons: flaggedReasons,
    },
    { onConflict: "conversation_id" },
  );

  if (error) {
    logger.error({ err: error, conversationId }, "logConversation: call_reviews upsert failed");
  }
}
