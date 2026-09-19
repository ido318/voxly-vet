import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getSystemPrompt, getUserPrompt } from "@/lib/ai/prompt-consolidation/prompt";
import type {
  ConsolidationInput,
  ConsolidationResult,
  PromptConsolidationProvider,
} from "@/lib/ai/prompt-consolidation/types";

export function getPromptConsolidationModelName(): string {
  // gpt-4o-mini reliably hallucinates a paraphrase instead of an exact
  // substring when asked to quote an anchor out of a long (10k+ char) live
  // prompt — even with a self-correction retry pointing out the exact
  // mismatch. gpt-4o is materially more reliable at grounded verbatim
  // quotation from a long context; this task runs rarely (admin-triggered),
  // so the extra cost doesn't matter.
  return process.env.AI_PROMPT_MERGE_MODEL ?? "gpt-4o";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function extractTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match || match[1] === undefined) {
    throw new Error(`Model response is missing the <${tag}> tag`);
  }
  return match[1].trim();
}

/**
 * Locates `anchor` inside `livePrompt`, tolerating whitespace-only quoting
 * slips (a run of spaces/newlines in the anchor matches any run of
 * whitespace in the source) — the most common way a model fails to quote
 * "verbatim" even when it copied the right passage. Everything else about
 * the anchor must match exactly. Returns the exact [start, end) range in
 * `livePrompt` actually matched, so splicing never touches anything the
 * model didn't intend to quote.
 */
function findAnchorRange(livePrompt: string, anchor: string): { start: number; end: number } {
  const pattern = anchor
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const matches = [...livePrompt.matchAll(new RegExp(pattern, "g"))];

  if (matches.length === 0) {
    throw new Error(`Model's <anchor> text was not found (even loosely) in the live prompt. Anchor was: ${JSON.stringify(anchor)}`);
  }
  if (matches.length > 1) {
    throw new Error(`Model's <anchor> text matches more than one location in the live prompt — ambiguous. Anchor was: ${JSON.stringify(anchor)}`);
  }

  const match = matches[0]!;
  return { start: match.index, end: match.index + match[0].length };
}

/**
 * Splices `insertion` into `livePrompt` at the location of `anchor`, never
 * touching anything else. A wrong or ambiguous splice point is worse than no
 * splice, so `findAnchorRange` throws rather than guessing.
 */
function spliceInsertion(livePrompt: string, anchor: string, position: "before" | "after", insertion: string): string {
  const { start, end } = findAnchorRange(livePrompt, anchor);
  const trimmedInsertion = insertion.trim();

  if (position === "before") {
    return livePrompt.slice(0, start) + trimmedInsertion + "\n\n" + livePrompt.slice(start);
  }
  return livePrompt.slice(0, end) + "\n\n" + trimmedInsertion + livePrompt.slice(end);
}

async function attemptConsolidation(
  input: ConsolidationInput,
  apiKey: string,
  modelName: string,
  userPrompt: string,
): Promise<ConsolidationResult> {
  const openai = createOpenAI({ apiKey });

  const { text, finishReason } = await generateText({
    model: openai(modelName),
    system: getSystemPrompt(),
    prompt: userPrompt,
    // The model only ever returns an anchor + a new insertion, never the
    // whole live prompt — comfortably covers even a large anchor quote
    // plus a substantial insertion, with no need to scale with live
    // prompt size the way echoing the full prompt back once did.
    maxOutputTokens: 3_000,
  });

  if (finishReason === "length") {
    throw new Error(
      "Consolidation response was truncated (hit the output token limit) — the anchor/insertion may be incomplete and was discarded",
    );
  }

  const anchor = extractTag(text, "anchor");
  const position = extractTag(text, "position");
  if (position !== "before" && position !== "after") {
    throw new Error(`Model returned an invalid <position> value: "${position}" (expected "before" or "after")`);
  }
  const insertion = extractTag(text, "insertion");
  const summary = extractTag(text, "summary");

  const mergedPrompt = spliceInsertion(input.livePrompt, anchor, position, insertion);
  return { mergedPrompt, summary };
}

export function createOpenAiPromptConsolidationProvider(): PromptConsolidationProvider {
  return {
    async consolidate(input: ConsolidationInput): Promise<ConsolidationResult> {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const modelName = getPromptConsolidationModelName();
      const userPrompt = getUserPrompt(input.livePrompt, input.suggestions);
      const MAX_PROMPT_CHARS = 60_000; // ~15k tokens at a conservative 4 chars/token — well under gpt-4o-mini's context window, generous for a voice-agent system prompt + several suggestions
      if (userPrompt.length > MAX_PROMPT_CHARS) {
        throw new Error(
          `Consolidation input is too large (${userPrompt.length} chars, limit ${MAX_PROMPT_CHARS}) — reduce the number of open suggestions before consolidating`,
        );
      }

      try {
        return await attemptConsolidation(input, apiKey, modelName, userPrompt);
      } catch (firstError) {
        // Quoting an exact anchor from memory is the one place this task
        // reliably trips models up — an unrelated tag/parse error is unlikely
        // to self-correct, but it costs nothing to give the model one more
        // try with its own mistake pointed out before giving up entirely.
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
        const retryPrompt = [
          userPrompt,
          "",
          "---",
          `ניסיון קודם שלך נכשל: ${firstMessage}`,
          "נסה שוב. חובה שקטע ה-<anchor> יהיה ציטוט מדויק ורציף מתוך הטקסט בין PROMPT_LIVE_BEGIN ל-PROMPT_LIVE_END, לא ניסוח שלך על סמך זיכרון. עדיף לבחור עוגן קצר (שורה אחת, לא כותרת) שאתה יכול להעתיק אות-באות ישירות מתוך הטקסט המצורף.",
        ].join("\n");

        try {
          return await attemptConsolidation(input, apiKey, modelName, retryPrompt);
        } catch (secondError) {
          const secondMessage = secondError instanceof Error ? secondError.message : String(secondError);
          throw new Error(`Consolidation failed twice. First attempt: ${firstMessage} | Retry: ${secondMessage}`);
        }
      }
    },
  };
}

export function createStubPromptConsolidationProvider(
  mergedPrompt = "פרומפט מאוחד לבדיקה",
  summary = "תקציר איחוד לבדיקה",
): PromptConsolidationProvider {
  return {
    async consolidate(): Promise<ConsolidationResult> {
      return { mergedPrompt, summary };
    },
  };
}

export async function consolidatePromptSuggestions(
  input: ConsolidationInput,
  provider?: PromptConsolidationProvider,
): Promise<ConsolidationResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubPromptConsolidationProvider()
      : createOpenAiPromptConsolidationProvider());

  return resolved.consolidate(input);
}
