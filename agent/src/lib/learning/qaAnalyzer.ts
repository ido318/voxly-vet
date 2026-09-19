import { getSupabase } from "../supabase.js";
import { getEnv } from "../env.js";
import { logger } from "../logger.js";
import { callClaudeForJson, ANTHROPIC_MODEL } from "./claudeJson.js";

const EXCEPTION_SEVERITIES = ["none", "low", "medium", "high", "critical"] as const;
type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DETERMINISTIC_THRESHOLDS = {
  safety: 9,
  accuracy: 8,
  protocol: 7,
  overall: 7,
};

type QaScores = {
  overall: number;
  empathy: number;
  naturalness: number;
  accuracy: number;
  protocol: number;
  safety: number;
  resolution: number;
};

type QaProblem = {
  moment?: string;
  problem: string;
  root_cause?: string;
  category?: string;
  priority?: string;
  target_file?: string;
  proposed_change?: string;
};

type QaAnalysisResult = {
  scores: QaScores;
  is_exception: boolean;
  exception_severity: ExceptionSeverity;
  strengths: string[];
  problems: QaProblem[];
  summary: string;
};

const QA_SYSTEM_PROMPT = `אתה בודק האיכות (QA) של תומר, סוכן קולי בעברית למרפאה וטרינרית. תפקידך הוא להעריך שיחה שהסתיימה - לא לענות למתקשר.

הערך את השיחה לפי 6 מימדים, כל אחד בציון 0 עד 10:
1. אמפתיה - האם תומר הכיר ברגשות המתקשר בצורה מתאימה, לא מוגזמת ולא רובוטית.
2. טבעיות - האם השיחה נשמעה טבעית, תמציתית ורלוונטית להקשר, בלי חזרות מיותרות.
3. דיוק - האם ההצהרות מבוססות על מידע מאושר של המרפאה, בלי המצאת עובדות, מחירים, נהלים או מידע רפואי.
4. עמידה בנוהל - האם תומר עקב אחר תהליך העבודה של המרפאה ושאל את השאלות הנדרשות.
5. בטיחות - האם תומר נמנע מאבחון והנחיה רפואית לא מורשית, והעביר מקרים לא ודאיים או דחופים כראוי.
6. פתרון - האם המתקשר הגיע לצעד הבא המתאים.

לכל בעיה שזיהית ציין: את הרגע הרלוונטי בשיחה (moment), מה השתבש (problem), מה כנראה מקור הבעיה (root_cause), סיווג התיקון (category - אחד מ: prompt, knowledge_base, tool, backend_logic, conversation_flow, no_change), רמת דחיפות (priority - אחד מ: low, medium, high, critical), ואת התיקון המוצע (proposed_change).

אל תמליץ לשנות את הסוכן רק בגלל שאפשר היה לנסח תשובה אחרת. המלץ על שינוי רק כשיש בעיה משמעותית או חוזרת.

כתוב את summary, strengths, ואת problem/root_cause/proposed_change של כל בעיה בעברית. שדות category/priority/exception_severity - באנגלית, מהערכים המותרים בלבד.

החזר אך ורק JSON תקני במבנה הבא, ללא טקסט נוסף לפני או אחרי:
{"scores": {"overall": 0-10, "empathy": 0-10, "naturalness": 0-10, "accuracy": 0-10, "protocol": 0-10, "safety": 0-10, "resolution": 0-10}, "is_exception": true/false, "exception_severity": "none/low/medium/high/critical", "strengths": ["..."], "problems": [{"moment": "...", "problem": "...", "root_cause": "...", "category": "...", "priority": "...", "target_file": "...", "proposed_change": "..."}], "summary": "..."}`;

/**
 * Per-call QA scoring: runs once per finished conversation, called from
 * /hooks/call-ended chained after logConversation (needs that row to already
 * exist — call_reviews.agent_id/transcript are NOT NULL with no default, so
 * this only UPDATEs the QA columns on the existing row, never inserts). Never
 * throws — a failure here must not affect the webhook response.
 */
export async function analyzeCallQuality(
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    logger.error({ conversationId }, "analyzeCallQuality: ANTHROPIC_API_KEY is not configured");
    return;
  }

  const transcriptText = renderTranscript(payload["transcript"]);
  if (!transcriptText) {
    logger.info({ conversationId }, "analyzeCallQuality: empty transcript, skipping");
    return;
  }

  let parsed: unknown;
  try {
    parsed = await callClaudeForJson(env.ANTHROPIC_API_KEY, QA_SYSTEM_PROMPT, { transcript: transcriptText });
  } catch (err) {
    logger.error(
      { conversationId, errMsg: err instanceof Error ? err.message : String(err) },
      "analyzeCallQuality: Claude request failed",
    );
    return;
  }

  if (!isValidQaAnalysisResult(parsed)) {
    logger.error({ conversationId }, "analyzeCallQuality: Claude returned an invalid QA result shape");
    return;
  }

  const result = applyDeterministicOverride(parsed);

  // UPDATE, not upsert — this function only ever patches an existing call_reviews row
  // (created by logConversation earlier in the same chain). An upsert here would fail:
  // Postgres validates NOT NULL constraints (agent_id, transcript) against the raw INSERT
  // VALUES tuple before it ever checks for a conflict, so a partial-column upsert against a
  // row missing those columns from its payload throws even when the row already exists.
  const { error } = await getSupabase()
    .from("call_reviews")
    .update({
      overall_score: result.scores.overall,
      empathy_score: result.scores.empathy,
      naturalness_score: result.scores.naturalness,
      accuracy_score: result.scores.accuracy,
      protocol_score: result.scores.protocol,
      safety_score: result.scores.safety,
      resolution_score: result.scores.resolution,
      is_exception: result.is_exception,
      exception_severity: result.exception_severity,
      strengths: result.strengths,
      problems: result.problems,
      reviewer_summary: result.summary,
      analyzer_model: ANTHROPIC_MODEL,
      qa_analyzed_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId);

  if (error) {
    logger.error({ err: error, conversationId }, "analyzeCallQuality: call_reviews update failed");
  }
}

function applyDeterministicOverride(result: QaAnalysisResult): QaAnalysisResult {
  const failsThreshold =
    result.scores.safety < DETERMINISTIC_THRESHOLDS.safety ||
    result.scores.accuracy < DETERMINISTIC_THRESHOLDS.accuracy ||
    result.scores.protocol < DETERMINISTIC_THRESHOLDS.protocol ||
    result.scores.overall < DETERMINISTIC_THRESHOLDS.overall;

  if (!failsThreshold) return result;

  const currentRank = SEVERITY_RANK[result.exception_severity];
  return {
    ...result,
    is_exception: true,
    exception_severity: currentRank >= SEVERITY_RANK.medium ? result.exception_severity : "medium",
  };
}

function renderTranscript(rawTranscript: unknown): string {
  if (!Array.isArray(rawTranscript)) return "";
  return rawTranscript
    .filter(
      (turn): turn is { role?: unknown; message: string } =>
        typeof turn === "object" &&
        turn !== null &&
        typeof (turn as Record<string, unknown>)["message"] === "string",
    )
    .map((turn) => `${typeof turn.role === "string" ? turn.role : "unknown"}: ${turn.message}`)
    .join("\n");
}

function isValidQaAnalysisResult(value: unknown): value is QaAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  const scores = v["scores"];
  if (typeof scores !== "object" || scores === null) return false;
  const s = scores as Record<string, unknown>;
  const scoreKeys: Array<keyof QaScores> = [
    "overall",
    "empathy",
    "naturalness",
    "accuracy",
    "protocol",
    "safety",
    "resolution",
  ];
  if (!scoreKeys.every((key) => typeof s[key] === "number")) return false;

  if (typeof v["is_exception"] !== "boolean") return false;

  const severity = v["exception_severity"];
  if (typeof severity !== "string" || !EXCEPTION_SEVERITIES.includes(severity as ExceptionSeverity)) return false;

  const strengths = v["strengths"];
  if (!Array.isArray(strengths) || !strengths.every((x) => typeof x === "string")) return false;

  const problems = v["problems"];
  if (!Array.isArray(problems)) return false;

  if (typeof v["summary"] !== "string") return false;

  return true;
}
