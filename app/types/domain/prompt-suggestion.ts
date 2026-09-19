export type PromptSuggestionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "failed_regression"
  | "merged";

export type PromptSuggestionCategory =
  | "prompt"
  | "knowledge_base"
  | "tool"
  | "backend_logic"
  | "conversation_flow";

export interface PromptSuggestion {
  id: string;
  clinicId: string;
  status: PromptSuggestionStatus;
  category: PromptSuggestionCategory;
  targetFile: string | null;
  patternSummary: string;
  proposedChange: string | null;
  rootCause: string | null;
  suggestedPrompt: string | null;
  supportingCallReviewIds: string[];
  regressionResult: Record<string, unknown> | null;
  previousPrompt: Record<string, unknown> | null;
  publishResult: Record<string, unknown> | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  mergedFromIds: string[] | null;
}

export interface RegressionOutcome {
  /** null when the run-tests response shape couldn't be confidently parsed — never publish in that case. */
  allPassed: boolean | null;
  raw: Record<string, unknown>;
}
