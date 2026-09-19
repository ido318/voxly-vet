export type CallReviewProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

export type CallReviewExceptionSeverity = "none" | "low" | "medium" | "high" | "critical";

export type CallReview = {
  id: string;
  clinicId: string;
  conversationId: string;
  agentId: string;
  versionId: string | null;
  callSuccessful: string | null;
  transcriptSummary: string | null;
  evaluationCriteriaResults: Record<string, unknown>;
  dataCollectionResults: Record<string, unknown>;
  flagged: boolean;
  flaggedReasons: string[];
  transcript: unknown[];
  callDurationSecs: number | null;
  qaAnalyzedAt: string | null;
  overallScore: number | null;
  empathyScore: number | null;
  naturalnessScore: number | null;
  accuracyScore: number | null;
  protocolScore: number | null;
  safetyScore: number | null;
  resolutionScore: number | null;
  isException: boolean;
  exceptionSeverity: CallReviewExceptionSeverity | null;
  strengths: string[];
  problems: CallReviewProblem[];
  reviewerSummary: string | null;
  analyzerModel: string | null;
  createdAt: string;
};

export type CallReviewSeverityFilter = "all" | CallReviewExceptionSeverity;
