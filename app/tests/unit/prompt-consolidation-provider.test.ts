import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: mockGenerateText }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => () => ({}) }));

import {
  createOpenAiPromptConsolidationProvider,
  createStubPromptConsolidationProvider,
  getPromptConsolidationModelName,
  isOpenAiConfigured,
} from "@/lib/ai/prompt-consolidation/provider";

describe("prompt-consolidation provider", () => {
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_PROMPT_MERGE_MODEL: process.env.AI_PROMPT_MERGE_MODEL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("isOpenAiConfigured", () => {
    it("returns false when OPENAI_API_KEY is unset or blank", () => {
      delete process.env.OPENAI_API_KEY;
      expect(isOpenAiConfigured()).toBe(false);
      process.env.OPENAI_API_KEY = "   ";
      expect(isOpenAiConfigured()).toBe(false);
    });

    it("returns true when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "sk-test-123";
      expect(isOpenAiConfigured()).toBe(true);
    });
  });

  describe("getPromptConsolidationModelName", () => {
    it("defaults to gpt-4o when unset", () => {
      delete process.env.AI_PROMPT_MERGE_MODEL;
      expect(getPromptConsolidationModelName()).toBe("gpt-4o");
    });

    it("uses the env override when set", () => {
      process.env.AI_PROMPT_MERGE_MODEL = "gpt-4o-mini";
      expect(getPromptConsolidationModelName()).toBe("gpt-4o-mini");
    });
  });

  describe("createStubPromptConsolidationProvider", () => {
    it("returns the given fixed mergedPrompt/summary", async () => {
      const provider = createStubPromptConsolidationProvider("merged text", "summary text");
      const result = await provider.consolidate({ livePrompt: "live", suggestions: [] });
      expect(result).toEqual({ mergedPrompt: "merged text", summary: "summary text" });
    });

    it("has sensible defaults when called with no args", async () => {
      const provider = createStubPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt: "live", suggestions: [] });
      expect(result.mergedPrompt).toBeTruthy();
      expect(result.summary).toBeTruthy();
    });
  });

  describe("createOpenAiPromptConsolidationProvider", () => {
    beforeEach(() => {
      mockGenerateText.mockReset();
      process.env.OPENAI_API_KEY = "sk-test-123";
    });

    function respond(anchor: string, position: "before" | "after", insertion: string, summary = "תקציר") {
      mockGenerateText.mockResolvedValue({
        text: `<anchor>\n${anchor}\n</anchor>\n<position>${position}</position>\n<insertion>\n${insertion}\n</insertion>\n<summary>\n${summary}\n</summary>`,
        finishReason: "stop",
      });
    }

    it("splices the insertion in after the anchor, leaving the rest of the live prompt untouched", async () => {
      const livePrompt = "כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\nסוף הפרומפט.";
      respond("כלל 2: אל תשקר.", "after", "כלל 3: שאל שאלה אחת בכל פעם.");

      const provider = createOpenAiPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt, suggestions: [] });

      expect(result.mergedPrompt).toBe(
        "כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\n\nכלל 3: שאל שאלה אחת בכל פעם.\nסוף הפרומפט.",
      );
      expect(result.summary).toBe("תקציר");
    });

    it("splices the insertion in before the anchor when position is 'before'", async () => {
      const livePrompt = "פתיחה.\nסעיף חשוב.\nסיום.";
      respond("סעיף חשוב.", "before", "הערה מקדימה.");

      const provider = createOpenAiPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt, suggestions: [] });

      expect(result.mergedPrompt).toBe("פתיחה.\nהערה מקדימה.\n\nסעיף חשוב.\nסיום.");
    });

    it("throws when the anchor does not appear (even loosely) in the live prompt", async () => {
      respond("טקסט שלא קיים בכלל", "after", "תוספת");

      const provider = createOpenAiPromptConsolidationProvider();
      await expect(provider.consolidate({ livePrompt: "פרומפט קצר.", suggestions: [] })).rejects.toThrow(
        "not found",
      );
    });

    it("tolerates whitespace-only quoting slips in the anchor (e.g. a single space vs. a newline)", async () => {
      const livePrompt = "כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\nסוף הפרומפט.";
      // Model quotes the anchor with a single space instead of the real newline before "כלל 2".
      respond("תמיד תגיד שלום. כלל 2: אל תשקר.", "after", "כלל 3: תוספת חדשה.");

      const provider = createOpenAiPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt, suggestions: [] });

      expect(result.mergedPrompt).toBe(
        "כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\n\nכלל 3: תוספת חדשה.\nסוף הפרומפט.",
      );
    });

    it("throws when the anchor matches more than one location (ambiguous)", async () => {
      respond("שאלה אחת", "after", "תוספת");

      const provider = createOpenAiPromptConsolidationProvider();
      await expect(
        provider.consolidate({ livePrompt: "שאלה אחת בכל פעם. גם כאן: שאלה אחת נוספת.", suggestions: [] }),
      ).rejects.toThrow("more than one location");
    });

    it("throws on an invalid <position> value", async () => {
      respond("כלל 2.", "sideways" as "after", "תוספת");

      const provider = createOpenAiPromptConsolidationProvider();
      await expect(provider.consolidate({ livePrompt: "כלל 1.\nכלל 2.", suggestions: [] })).rejects.toThrow(
        "invalid <position>",
      );
    });

    it("retries once with the failure explained, and succeeds if the second attempt quotes a valid anchor", async () => {
      const livePrompt = "כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\nסוף הפרומפט.";
      mockGenerateText
        .mockResolvedValueOnce({
          text: "<anchor>\nכותרת שלא קיימת בכלל\n</anchor>\n<position>after</position>\n<insertion>\nתוספת\n</insertion>\n<summary>\nתקציר\n</summary>",
          finishReason: "stop",
        })
        .mockResolvedValueOnce({
          text: "<anchor>\nכלל 2: אל תשקר.\n</anchor>\n<position>after</position>\n<insertion>\nכלל 3: תוספת.\n</insertion>\n<summary>\nתקציר\n</summary>",
          finishReason: "stop",
        });

      const provider = createOpenAiPromptConsolidationProvider();
      const result = await provider.consolidate({ livePrompt, suggestions: [] });

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.mergedPrompt).toBe("כלל 1: תמיד תגיד שלום.\nכלל 2: אל תשקר.\n\nכלל 3: תוספת.\nסוף הפרומפט.");
      // The retry prompt should explain what went wrong the first time.
      const retryCallPrompt = mockGenerateText.mock.calls[1]![0].prompt as string;
      expect(retryCallPrompt).toContain("ניסיון קודם שלך נכשל");
    });

    it("throws a combined error when both the original attempt and the retry fail", async () => {
      respond("טקסט שלא קיים", "after", "תוספת");

      const provider = createOpenAiPromptConsolidationProvider();
      await expect(provider.consolidate({ livePrompt: "פרומפט קצר.", suggestions: [] })).rejects.toThrow(
        "Consolidation failed twice",
      );
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });

    it("throws when the response was truncated (finishReason length)", async () => {
      mockGenerateText.mockResolvedValue({ text: "<anchor>x</anchor>", finishReason: "length" });

      const provider = createOpenAiPromptConsolidationProvider();
      await expect(provider.consolidate({ livePrompt: "כלל 1.", suggestions: [] })).rejects.toThrow("truncated");
    });
  });
});
