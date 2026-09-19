import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  buildVisitSummaryContext,
  serializeContextForPrompt,
} from "@/lib/ai/visit-summary/build-context";
import { getSystemPrompt, getUserPrompt } from "@/lib/ai/visit-summary/prompt";
import type {
  VisitSummaryContext,
  VisitSummaryGenerationResult,
  VisitSummaryProvider,
} from "@/lib/ai/visit-summary/types";

export function getVisitSummaryModelName(): string {
  return process.env.AI_VISIT_SUMMARY_MODEL ?? "gpt-4o-mini";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function createOpenAiVisitSummaryProvider(): VisitSummaryProvider {
  return {
    async generateSummary(
      context: VisitSummaryContext,
    ): Promise<VisitSummaryGenerationResult> {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const modelName = getVisitSummaryModelName();
      const openai = createOpenAI({ apiKey });
      const clinicalContext = serializeContextForPrompt(context);

      const { text } = await generateText({
        model: openai(modelName),
        system: getSystemPrompt(),
        prompt: getUserPrompt(clinicalContext),
        maxOutputTokens: 1200,
      });

      const draftText = text.trim();
      if (!draftText) {
        throw new Error("Model returned an empty summary");
      }

      return { draftText, modelName };
    },
  };
}

export function createStubVisitSummaryProvider(
  draftText = "סיכום בדיקה לדוגמה לצורכי בדיקות.",
): VisitSummaryProvider {
  return {
    async generateSummary(): Promise<VisitSummaryGenerationResult> {
      return { draftText, modelName: "stub" };
    },
  };
}

export async function generateVisitSummaryDraft(
  context: VisitSummaryContext,
  provider?: VisitSummaryProvider,
): Promise<VisitSummaryGenerationResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubVisitSummaryProvider()
      : createOpenAiVisitSummaryProvider());

  return resolved.generateSummary(context);
}

export { buildVisitSummaryContext };
