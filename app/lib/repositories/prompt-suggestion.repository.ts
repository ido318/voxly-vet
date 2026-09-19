import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { PromptSuggestion, PromptSuggestionCategory, PromptSuggestionStatus } from "@/types/domain/prompt-suggestion";

function isNoRowsMatchedError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "PGRST116";
}

const PROMPT_SUGGESTION_CATEGORIES: readonly PromptSuggestionCategory[] = [
  "prompt",
  "knowledge_base",
  "tool",
  "backend_logic",
  "conversation_flow",
];

function isPromptSuggestionCategory(value: unknown): value is PromptSuggestionCategory {
  return typeof value === "string" && (PROMPT_SUGGESTION_CATEGORIES as readonly string[]).includes(value);
}

function mapPromptSuggestionRow(row: Record<string, unknown>): PromptSuggestion {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    status: row.status as PromptSuggestionStatus,
    // Defensive fallback: if this row predates the category migration (or the
    // app deploys before the migration is applied — app/ auto-deploys on
    // every push to main, the migration is a separate manual step), default
    // to 'prompt' so approve() still runs regression+publish rather than
    // silently skipping it via the markApproved shortcut. Never let a
    // missing/unrecognized value take the "skip regression" path.
    category: isPromptSuggestionCategory(row.category) ? row.category : "prompt",
    targetFile: (row.target_file as string | null) ?? null,
    patternSummary: row.pattern_summary as string,
    proposedChange: (row.proposed_change as string | null) ?? null,
    rootCause: (row.root_cause as string | null) ?? null,
    suggestedPrompt: (row.suggested_prompt as string | null) ?? null,
    supportingCallReviewIds: (row.supporting_call_review_ids as string[] | null) ?? [],
    regressionResult: (row.regression_result as Record<string, unknown> | null) ?? null,
    previousPrompt: (row.previous_prompt as Record<string, unknown> | null) ?? null,
    publishResult: (row.publish_result as Record<string, unknown> | null) ?? null,
    reviewedByUserId: (row.reviewed_by_user_id as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    mergedFromIds: (row.merged_from_ids as string[] | null) ?? null,
  };
}

/**
 * Backed by the service-role client. `tomer_prompt_suggestions` is deny-by-default
 * under RLS (same pattern as visit_shares), so this repository must be
 * constructed with the admin client. Permission checks happen one layer up,
 * in PromptSuggestionService.
 */
export class PromptSuggestionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByStatus(status: PromptSuggestionStatus): Promise<Result<PromptSuggestion[]>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list prompt suggestions", error));
    return ok((data ?? []).map(mapPromptSuggestionRow));
  }

  async findById(id: string): Promise<Result<PromptSuggestion | null>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load prompt suggestion", error));
    return ok(data ? mapPromptSuggestionRow(data as Record<string, unknown>) : null);
  }

  /**
   * Most recent suggestion whose supporting_call_review_ids includes this call review, if any.
   * A call review could in theory back more than one suggestion over time — this deliberately
   * returns only the newest rather than asserting uniqueness.
   */
  async findBySupportingCallReviewId(callReviewId: string): Promise<Result<PromptSuggestion | null>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .select("*")
      .contains("supporting_call_review_ids", [callReviewId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to look up linked prompt suggestion", error));
    return ok(data ? mapPromptSuggestionRow(data as Record<string, unknown>) : null);
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markRejected(id: string, reviewedByUserId: string): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .update({
        status: "rejected",
        reviewed_by_user_id: reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to reject prompt suggestion", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markApproved(id: string, reviewedByUserId: string): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .update({
        status: "approved",
        reviewed_by_user_id: reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to approve prompt suggestion", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /**
   * Regression ran but the response couldn't be trusted, or a test failed — persist and stop.
   * Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly.
   */
  async recordRegressionResult(
    id: string,
    input: { status: "pending" | "failed_regression"; regressionResult: Record<string, unknown>; reviewedByUserId: string },
  ): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .update({
        status: input.status,
        regression_result: input.regressionResult,
        reviewed_by_user_id: input.reviewedByUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to record regression result", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /** Guarded by `.eq("status", "pending")` — a concurrent review already in flight loses this race cleanly. */
  async markPublished(
    id: string,
    input: {
      regressionResult: Record<string, unknown>;
      previousPrompt: Record<string, unknown>;
      publishResult: Record<string, unknown>;
      reviewedByUserId: string;
    },
  ): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .update({
        status: "published",
        regression_result: input.regressionResult,
        previous_prompt: input.previousPrompt,
        publish_result: input.publishResult,
        reviewed_by_user_id: input.reviewedByUserId,
        reviewed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) {
      if (isNoRowsMatchedError(error)) {
        return err(AppError.conflict("Prompt suggestion was already reviewed by someone else"));
      }
      return err(AppError.externalProvider("Failed to mark prompt suggestion published", error));
    }
    return ok(mapPromptSuggestionRow(data));
  }

  /** Creates the meta-suggestion produced by "consolidate all pending". Always category='prompt', status='pending'. */
  async createFromMerge(input: {
    clinicId: string;
    patternSummary: string;
    proposedChange: string;
    suggestedPrompt: string;
    supportingCallReviewIds: string[];
    mergedFromIds: string[];
  }): Promise<Result<PromptSuggestion>> {
    const { data, error } = await this.client
      .from("tomer_prompt_suggestions")
      .insert({
        clinic_id: input.clinicId,
        status: "pending",
        category: "prompt",
        pattern_summary: input.patternSummary,
        proposed_change: input.proposedChange,
        suggested_prompt: input.suggestedPrompt,
        supporting_call_review_ids: input.supportingCallReviewIds,
        merged_from_ids: input.mergedFromIds,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create merged prompt suggestion", error));
    return ok(mapPromptSuggestionRow(data));
  }

  /**
   * Bulk-marks the source suggestions consumed by a merge. Guarded by
   * status='pending' per row, same race-safety as markApproved/markRejected —
   * a row already reviewed elsewhere between the merge's read and this write
   * is simply skipped rather than clobbered.
   */
  async markMerged(ids: string[]): Promise<Result<void>> {
    const { error } = await this.client
      .from("tomer_prompt_suggestions")
      .update({ status: "merged" })
      .in("id", ids)
      .eq("status", "pending");
    if (error) return err(AppError.externalProvider("Failed to mark suggestions merged", error));
    return ok(undefined);
  }
}
