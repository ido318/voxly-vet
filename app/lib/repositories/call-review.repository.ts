import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapCallReviewRow(row: Record<string, unknown>): CallReview {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    conversationId: row.conversation_id as string,
    agentId: row.agent_id as string,
    versionId: (row.version_id as string | null) ?? null,
    callSuccessful: (row.call_successful as string | null) ?? null,
    transcriptSummary: (row.transcript_summary as string | null) ?? null,
    evaluationCriteriaResults: (row.evaluation_criteria_results as Record<string, unknown>) ?? {},
    dataCollectionResults: (row.data_collection_results as Record<string, unknown>) ?? {},
    flagged: Boolean(row.flagged),
    flaggedReasons: (row.flagged_reasons as string[] | null) ?? [],
    transcript: (row.transcript as unknown[] | null) ?? [],
    callDurationSecs: num(row.call_duration_secs),
    qaAnalyzedAt: (row.qa_analyzed_at as string | null) ?? null,
    overallScore: num(row.overall_score),
    empathyScore: num(row.empathy_score),
    naturalnessScore: num(row.naturalness_score),
    accuracyScore: num(row.accuracy_score),
    protocolScore: num(row.protocol_score),
    safetyScore: num(row.safety_score),
    resolutionScore: num(row.resolution_score),
    isException: Boolean(row.is_exception),
    exceptionSeverity: (row.exception_severity as CallReview["exceptionSeverity"]) ?? null,
    strengths: (row.strengths as string[] | null) ?? [],
    problems: (row.problems as CallReview["problems"] | null) ?? [],
    reviewerSummary: (row.reviewer_summary as string | null) ?? null,
    analyzerModel: (row.analyzer_model as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Backed by the service-role client — call_reviews is deny-by-default under
 * RLS. Unlike every clinic-scoped repository in this app, listRecent()
 * deliberately does NOT filter by clinic_id: provider_admin is a site-wide
 * role, not a clinic membership.
 */
export class CallReviewRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRecent(params: {
    sinceDays: number;
    severity: CallReviewSeverityFilter;
    limit: number;
    offset: number;
  }): Promise<Result<{ items: CallReview[]; total: number }>> {
    const since = new Date(Date.now() - params.sinceDays * 24 * 60 * 60 * 1000).toISOString();

    let query = this.client
      .from("call_reviews")
      .select("*", { count: "exact" })
      .gte("created_at", since)
      .order("is_exception", { ascending: false })
      .order("created_at", { ascending: false });

    if (params.severity !== "all") {
      query = query.eq("exception_severity", params.severity);
    }

    const { data, error, count } = await query.range(params.offset, params.offset + params.limit - 1);
    if (error) return err(AppError.externalProvider("Failed to list call reviews", error));
    return ok({ items: (data ?? []).map(mapCallReviewRow), total: count ?? 0 });
  }

  async findById(id: string): Promise<Result<CallReview | null>> {
    const { data, error } = await this.client.from("call_reviews").select("*").eq("id", id).maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load call review", error));
    return ok(data ? mapCallReviewRow(data as Record<string, unknown>) : null);
  }
}
