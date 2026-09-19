import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson } from "./claudeJson.js";

const MIN_GROUP_SIZE = 2;
const LOOKBACK_DAYS = 7;

const ACTIONABLE_CATEGORIES = ["prompt", "knowledge_base", "tool", "backend_logic", "conversation_flow"] as const;
type ActionableCategory = (typeof ACTIONABLE_CATEGORIES)[number];

function isActionableCategory(value: string): value is ActionableCategory {
  return (ACTIONABLE_CATEGORIES as readonly string[]).includes(value);
}

type QaProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

type FlaggedCallReview = {
  id: string;
  problems: QaProblem[] | null;
  transcript_summary: string | null;
};

type GroupedProblem = {
  problem: string;
  root_cause?: string;
  moment?: string;
  callSummary: string | null;
  reviewId: string;
};

type ProblemGroup = {
  category: ActionableCategory;
  targetFile: string | null;
  items: GroupedProblem[];
};

export type AnalyzeConversationsResult = {
  ranAnalysis: boolean;
  flaggedCallCount: number;
  groupsConsidered: number;
  suggestionIds: string[];
};

/**
 * Weekly job: pulls flagged call_reviews from the last 7 days, groups their
 * qaAnalyzer-tagged problems by (category, target_file), and asks Claude
 * once per qualifying group (>= MIN_GROUP_SIZE occurrences) to propose a fix
 * — a full suggested_prompt only when category === 'prompt', otherwise just
 * a pattern_summary + proposed_change for manual follow-through. Writes one
 * tomer_prompt_suggestions row per qualifying group.
 */
export async function analyzeConversations(clinicId: string): Promise<AnalyzeConversationsResult> {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: flaggedReviews, error: reviewsErr } = await getSupabase()
    .from("call_reviews")
    .select("id, problems, transcript_summary")
    .eq("clinic_id", clinicId)
    .eq("is_exception", true)
    .gte("created_at", since);

  if (reviewsErr) throw new Error(`analyzeConversations: call_reviews query failed: ${reviewsErr.message}`);

  const reviews = (flaggedReviews ?? []) as FlaggedCallReview[];
  const groups = groupProblems(reviews);
  const qualifyingGroups = groups.filter((g) => countDistinctReviewIds(g) >= MIN_GROUP_SIZE);

  if (qualifyingGroups.length === 0) {
    logger.info(
      { clinicId, flaggedCount: reviews.length, groupsConsidered: groups.length },
      "analyzeConversations: no group met the minimum threshold, no-op",
    );
    return { ranAnalysis: false, flaggedCallCount: reviews.length, groupsConsidered: groups.length, suggestionIds: [] };
  }

  const suggestionIds: string[] = [];

  for (const group of qualifyingGroups) {
    try {
      const suggestionId = await createSuggestionForGroup(env.ANTHROPIC_API_KEY, clinicId, group);
      suggestionIds.push(suggestionId);
    } catch (err) {
      logger.error(
        {
          clinicId,
          category: group.category,
          targetFile: group.targetFile,
          errMsg: err instanceof Error ? err.message : String(err),
        },
        "analyzeConversations: failed to create suggestion for group, continuing with remaining groups",
      );
    }
  }

  logger.info(
    { clinicId, flaggedCount: reviews.length, groupsConsidered: groups.length, suggestionsCreated: suggestionIds.length },
    "analyzeConversations: run complete",
  );

  return { ranAnalysis: true, flaggedCallCount: reviews.length, groupsConsidered: groups.length, suggestionIds };
}

function groupProblems(reviews: FlaggedCallReview[]): ProblemGroup[] {
  const groupsByKey = new Map<string, ProblemGroup>();

  for (const review of reviews) {
    for (const problem of review.problems ?? []) {
      const category = problem.category;
      if (!category || !isActionableCategory(category)) continue;

      const targetFile = problem.target_file?.trim() || null;
      const key = `${category}::${targetFile ?? ""}`;

      let group = groupsByKey.get(key);
      if (!group) {
        group = { category, targetFile, items: [] };
        groupsByKey.set(key, group);
      }

      group.items.push({
        problem: problem.problem,
        root_cause: problem.root_cause,
        moment: problem.moment,
        callSummary: review.transcript_summary,
        reviewId: review.id,
      });
    }
  }

  return Array.from(groupsByKey.values());
}

function countDistinctReviewIds(group: ProblemGroup): number {
  return new Set(group.items.map((i) => i.reviewId)).size;
}

const MAX_ROOT_CAUSE_LENGTH = 1000;

function capRootCause(joined: string): string {
  if (joined.length <= MAX_ROOT_CAUSE_LENGTH) return joined;
  return joined.slice(0, MAX_ROOT_CAUSE_LENGTH - 3) + "...";
}

type SuggestionDraft = { pattern_summary: string; proposed_change: string; suggested_prompt: string | null };

async function createSuggestionForGroup(apiKey: string, clinicId: string, group: ProblemGroup): Promise<string> {
  const draft = await requestGroupSuggestion(apiKey, group);

  const rootCauses = Array.from(new Set(group.items.map((i) => i.root_cause).filter((v): v is string => Boolean(v))));

  const { data: inserted, error: insertErr } = await getSupabase()
    .from("tomer_prompt_suggestions")
    .insert({
      clinic_id: clinicId,
      status: "pending",
      category: group.category,
      target_file: group.targetFile,
      pattern_summary: draft.pattern_summary,
      proposed_change: draft.proposed_change,
      root_cause: rootCauses.length > 0 ? capRootCause(rootCauses.join(" | ")) : null,
      suggested_prompt: draft.suggested_prompt,
      supporting_call_review_ids: Array.from(new Set(group.items.map((i) => i.reviewId))),
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`analyzeConversations: tomer_prompt_suggestions insert failed: ${insertErr.message}`);

  return inserted.id as string;
}

async function requestGroupSuggestion(apiKey: string, group: ProblemGroup): Promise<SuggestionDraft> {
  const systemPrompt =
    `אתה עוזר שמנתח דפוס חוזר של בעיות מסוג "${group.category}" בקוד/פרומפט/תוכן של תומר, סוכן קולי וטרינרי בעברית. ` +
    `קיבלת ${group.items.length} מקרים מתועדים עם אותו category ואותו target_file ("${group.targetFile ?? "(ריק)"}"). ` +
    "זהה את הדפוס המשותף והצע תיקון קונקרטי.\n\n" +
    'אם category=="prompt": הצע גם נוסח מלא ומתוקן לפרומפט המערכת (suggested_prompt). אחרת: השאר suggested_prompt כ-null — רק pattern_summary + proposed_change.\n\n' +
    'החזר אך ורק JSON: {"pattern_summary": "...", "proposed_change": "...", "suggested_prompt": "..." | null}';

  const cases = group.items.map((i) => ({
    problem: i.problem,
    root_cause: i.root_cause ?? null,
    moment: i.moment ?? null,
    call_summary: i.callSummary,
  }));

  const parsed = await callClaudeForJson(apiKey, systemPrompt, { cases });

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["pattern_summary"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["proposed_change"] !== "string"
  ) {
    throw new Error("Anthropic API JSON missing required fields");
  }

  const record = parsed as Record<string, unknown>;
  const suggestedPrompt = typeof record["suggested_prompt"] === "string" ? record["suggested_prompt"] : null;

  return {
    pattern_summary: record["pattern_summary"] as string,
    proposed_change: record["proposed_change"] as string,
    suggested_prompt: suggestedPrompt,
  };
}
