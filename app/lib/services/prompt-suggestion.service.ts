import { AppError, err, type Result } from "@/lib/errors/app-error";
import { consolidatePromptSuggestions } from "@/lib/ai/prompt-consolidation/provider";
import { getLiveAgentConfig, publishPrompt, runRegressionTests } from "@/lib/learning/elevenlabsTesting";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

/**
 * Permission is enforced once, upstream, by requireProviderAdmin() at the
 * API route boundary — this service does no actor/role checking of its own.
 */
export class PromptSuggestionService {
  constructor(private readonly repo: PromptSuggestionRepository) {}

  async listPending(): Promise<Result<PromptSuggestion[]>> {
    return this.repo.listByStatus("pending");
  }

  async reject(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    if (existing.value.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${existing.value.status}`));
    }

    return this.repo.markRejected(id, reviewedByUserId);
  }

  /**
   * Regression-tests the candidate prompt before publishing. Only publishes
   * when every test passed AND the response could be confidently parsed —
   * an ambiguous response leaves the suggestion pending with the raw result
   * attached, never publishing on an unverified guess. Whether a suggestion
   * gets auto-published is decided by the presence of suggested_prompt, not
   * by category — the QA analyzer sometimes attaches a full suggested_prompt
   * to a non-'prompt' category (e.g. 'conversation_flow') when the fix is in
   * fact best expressed as a prompt change, and that content should still
   * reach ElevenLabs. Suggestions with no suggested_prompt at all are marked
   * approved directly, for manual follow-through outside this pipeline.
   */
  async approve(reviewedByUserId: string, id: string): Promise<Result<PromptSuggestion>> {
    const existing = await this.repo.findById(id);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Prompt suggestion not found"));
    const suggestion = existing.value;

    if (suggestion.status !== "pending") {
      return err(AppError.conflict(`Prompt suggestion already ${suggestion.status}`));
    }

    if (!suggestion.suggestedPrompt) {
      return this.repo.markApproved(id, reviewedByUserId);
    }

    const regression = await runRegressionTests(suggestion.suggestedPrompt).catch((error: unknown) => {
      throw AppError.externalProvider(
        "Failed to run ElevenLabs regression tests",
        error instanceof Error ? error.message : error,
      );
    });

    if (regression.allPassed !== true) {
      // Covers both a confirmed failure and an ambiguous/unparseable response —
      // either way we do not publish. Status distinguishes the two for the UI.
      return this.repo.recordRegressionResult(id, {
        status: regression.allPassed === false ? "failed_regression" : "pending",
        regressionResult: regression.raw,
        reviewedByUserId,
      });
    }

    let previousPrompt: Record<string, unknown>;
    let publishResult: Record<string, unknown>;
    try {
      previousPrompt = await getLiveAgentConfig();
      publishResult = await publishPrompt(suggestion.suggestedPrompt);
    } catch (error) {
      return err(
        AppError.externalProvider(
          "Regression passed but publish failed",
          error instanceof Error ? error.message : error,
        ),
      );
    }

    return this.repo.markPublished(id, {
      regressionResult: regression.raw,
      previousPrompt,
      publishResult,
      reviewedByUserId,
    });
  }

  /**
   * Consolidates every pending suggestion that carries a suggested_prompt
   * (regardless of category — see approve() for why) into one new
   * meta-suggestion (via an LLM call over the live prompt + all candidates'
   * full content), then marks the originals 'merged'. The new suggestion is
   * a normal pending suggestion afterwards — approving it runs the exact
   * same regression+publish pipeline as any other, no new code path there.
   */
  async consolidatePending(): Promise<Result<PromptSuggestion>> {
    const pendingResult = await this.repo.listByStatus("pending");
    if (!pendingResult.ok) return pendingResult;

    const candidates = pendingResult.value.filter((s) => s.suggestedPrompt);
    if (candidates.length < 2) {
      return err(AppError.conflict("At least 2 pending suggestions with a suggested_prompt are required to consolidate"));
    }

    let livePrompt: string;
    try {
      const config = await getLiveAgentConfig();
      const agent = config as { agent?: { prompt?: { prompt?: string } } };
      livePrompt = agent.agent?.prompt?.prompt ?? "";
    } catch (error) {
      return err(
        AppError.externalProvider(
          "Failed to fetch the live agent prompt",
          error instanceof Error ? error.message : error,
        ),
      );
    }

    let result: { mergedPrompt: string; summary: string };
    try {
      result = await consolidatePromptSuggestions({
        livePrompt,
        suggestions: candidates.map((s) => ({
          patternSummary: s.patternSummary,
          proposedChange: s.proposedChange,
          rootCause: s.rootCause,
          suggestedPrompt: s.suggestedPrompt,
        })),
      });
    } catch (error) {
      return err(
        AppError.externalProvider(
          "Failed to consolidate prompt suggestions",
          error instanceof Error ? error.message : error,
        ),
      );
    }

    const created = await this.repo.createFromMerge({
      // Safe: candidates.length >= 2 was checked above.
      clinicId: candidates[0]!.clinicId,
      patternSummary: `איחוד ${candidates.length} הצעות תיקון פתוחות`,
      proposedChange: result.summary,
      suggestedPrompt: result.mergedPrompt,
      supportingCallReviewIds: [...new Set(candidates.flatMap((s) => s.supportingCallReviewIds))],
      mergedFromIds: candidates.map((s) => s.id),
    });
    if (!created.ok) return created;

    // Best-effort: the new suggestion already exists and is what the caller
    // needs — if marking the originals 'merged' fails, surface the new
    // suggestion anyway rather than erroring out a successful creation. A
    // stray still-pending original is a cosmetic annoyance (visible in the
    // list once more), not a correctness or data-loss problem.
    const markMergedResult = await this.repo.markMerged(candidates.map((s) => s.id));
    if (!markMergedResult.ok) {
      console.error("[PromptSuggestionService.consolidatePending] markMerged failed after successful createFromMerge", {
        mergedSuggestionId: created.value.id,
        sourceIds: candidates.map((s) => s.id),
        error: markMergedResult.error,
      });
    }

    return created;
  }
}
