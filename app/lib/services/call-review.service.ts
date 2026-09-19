import { ok, type Result } from "@/lib/errors/app-error";
import type { CallReviewRepository } from "@/lib/repositories/call-review.repository";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { CallReview, CallReviewSeverityFilter } from "@/types/domain/call-review";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

const PAGE_SIZE = 50;
const LOOKBACK_DAYS = 30;

/**
 * No actor-based filtering here — requireProviderAdmin() already gates
 * every route this service is reachable from, and call_reviews is not
 * clinic-scoped for provider_admin.
 */
export class CallReviewService {
  constructor(
    private readonly repo: CallReviewRepository,
    private readonly promptSuggestionRepo: PromptSuggestionRepository,
  ) {}

  async list(params: { severity: CallReviewSeverityFilter; page: number }): Promise<Result<{ items: CallReview[]; total: number }>> {
    const page = Math.max(1, params.page);
    return this.repo.listRecent({
      sinceDays: LOOKBACK_DAYS,
      severity: params.severity,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  }

  async getWithLinkedSuggestion(
    id: string,
  ): Promise<Result<{ review: CallReview; linkedSuggestion: PromptSuggestion | null } | null>> {
    const reviewResult = await this.repo.findById(id);
    if (!reviewResult.ok) return reviewResult;
    if (!reviewResult.value) return ok(null);

    const suggestionResult = await this.promptSuggestionRepo.findBySupportingCallReviewId(id);
    if (!suggestionResult.ok) return suggestionResult;

    return ok({ review: reviewResult.value, linkedSuggestion: suggestionResult.value });
  }
}
