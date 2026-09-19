export type ConsolidationSuggestionInput = {
  patternSummary: string;
  proposedChange: string | null;
  rootCause: string | null;
  suggestedPrompt: string | null;
};

export type ConsolidationInput = {
  livePrompt: string;
  suggestions: ConsolidationSuggestionInput[];
};

export type ConsolidationResult = {
  mergedPrompt: string;
  summary: string;
};

export interface PromptConsolidationProvider {
  consolidate(input: ConsolidationInput): Promise<ConsolidationResult>;
}
