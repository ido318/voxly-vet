import { describe, expect, it, vi, beforeEach } from "vitest";
import { ok, err, AppError } from "@/lib/errors/app-error";
import { PromptSuggestionService } from "@/lib/services/prompt-suggestion.service";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

const { mockRunRegressionTests, mockGetLiveAgentConfig, mockPublishPrompt, mockConsolidatePromptSuggestions } =
  vi.hoisted(() => ({
    mockRunRegressionTests: vi.fn(),
    mockGetLiveAgentConfig: vi.fn(),
    mockPublishPrompt: vi.fn(),
    mockConsolidatePromptSuggestions: vi.fn(),
  }));

vi.mock("@/lib/learning/elevenlabsTesting", () => ({
  runRegressionTests: mockRunRegressionTests,
  getLiveAgentConfig: mockGetLiveAgentConfig,
  publishPrompt: mockPublishPrompt,
}));

vi.mock("@/lib/ai/prompt-consolidation/provider", () => ({
  consolidatePromptSuggestions: mockConsolidatePromptSuggestions,
}));

const REVIEWER_ID = "user-2";

function suggestion(overrides: Partial<PromptSuggestion> = {}): PromptSuggestion {
  return {
    id: "sugg-1",
    clinicId: "clinic-target",
    status: "pending",
    category: "prompt",
    targetFile: null,
    patternSummary: "תומר משתמש בביטוי אסור",
    proposedChange: "להסיר את הביטוי מהפרומפט",
    rootCause: null,
    suggestedPrompt: "פרומפט מתוקן",
    supportingCallReviewIds: ["r1", "r2"],
    regressionResult: null,
    previousPrompt: null,
    publishResult: null,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-08-20T09:00:00.000Z",
    mergedFromIds: null,
    ...overrides,
  };
}

function buildService(overrides: Partial<ReturnType<typeof baseRepo>> = {}) {
  const repo = { ...baseRepo(), ...overrides };
  const service = new PromptSuggestionService(repo as unknown as PromptSuggestionRepository);
  return { service, repo };
}

function baseRepo() {
  return {
    listByStatus: vi.fn().mockResolvedValue(ok([suggestion()])),
    findById: vi.fn().mockResolvedValue(ok(suggestion())),
    markRejected: vi.fn().mockResolvedValue(ok(suggestion({ status: "rejected" }))),
    markApproved: vi.fn().mockResolvedValue(ok(suggestion({ status: "approved" }))),
    recordRegressionResult: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(ok(suggestion({ status: input.status, regressionResult: input.regressionResult }))),
    ),
    markPublished: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(
        ok(
          suggestion({
            status: "published",
            regressionResult: input.regressionResult,
            previousPrompt: input.previousPrompt,
            publishResult: input.publishResult,
          }),
        ),
      ),
    ),
    createFromMerge: vi.fn().mockResolvedValue(ok(suggestion({ id: "merged-1", category: "prompt" }))),
    markMerged: vi.fn().mockResolvedValue(ok(undefined)),
  };
}

beforeEach(() => {
  mockRunRegressionTests.mockReset();
  mockGetLiveAgentConfig.mockReset();
  mockPublishPrompt.mockReset();
  mockConsolidatePromptSuggestions.mockReset();
});

describe("PromptSuggestionService.reject", () => {
  it("rejects a pending suggestion", async () => {
    const { service, repo } = buildService();
    const result = await service.reject(REVIEWER_ID, "sugg-1");
    expect(result.ok).toBe(true);
    expect(repo.markRejected).toHaveBeenCalledWith("sugg-1", REVIEWER_ID);
  });

  it("returns notFound when the suggestion does not exist", async () => {
    const { service } = buildService({ findById: vi.fn().mockResolvedValue(ok(null)) });
    const result = await service.reject(REVIEWER_ID, "missing");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(404);
  });
});

describe("PromptSuggestionService.approve", () => {
  it("marks non-prompt categories approved without running regression or publish", async () => {
    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ category: "knowledge_base", suggestedPrompt: null }))),
    });

    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");
    expect(repo.markApproved).toHaveBeenCalledWith("sugg-1", REVIEWER_ID);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
    expect(mockPublishPrompt).not.toHaveBeenCalled();
  });

  it.each(["tool", "backend_logic", "conversation_flow"] as const)(
    "marks category '%s' approved without publish, same as knowledge_base",
    async (category) => {
      const { service, repo } = buildService({
        findById: vi.fn().mockResolvedValue(ok(suggestion({ category, suggestedPrompt: null }))),
      });

      const result = await service.approve(REVIEWER_ID, "sugg-1");

      expect(result.ok).toBe(true);
      expect(repo.markApproved).toHaveBeenCalledOnce();
      expect(mockRunRegressionTests).not.toHaveBeenCalled();
    },
  );

  it("marks a 'prompt' category suggestion approved without publish when it has no suggested_prompt", async () => {
    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ category: "prompt", suggestedPrompt: null }))),
    });

    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    expect(repo.markApproved).toHaveBeenCalledWith("sugg-1", REVIEWER_ID);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("runs regression and publishes a non-'prompt' category suggestion that carries a suggested_prompt", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: { test_results: [] } });
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "old prompt" } } });
    mockPublishPrompt.mockResolvedValue({ agent_id: "agent_1" });

    const { service, repo } = buildService({
      findById: vi.fn().mockResolvedValue(
        ok(suggestion({ category: "conversation_flow", suggestedPrompt: "פרומפט מתוקן לזרימת שיחה" })),
      ),
    });

    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("published");
    expect(mockPublishPrompt).toHaveBeenCalledWith("פרומפט מתוקן לזרימת שיחה");
    expect(repo.markPublished).toHaveBeenCalledOnce();
  });

  it("refuses to re-approve a suggestion that was already reviewed", async () => {
    const { service } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ status: "published" }))),
    });
    const result = await service.approve(REVIEWER_ID, "sugg-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("publishes when every regression test passes", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: { test_results: [] } });
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "old prompt" } } });
    mockPublishPrompt.mockResolvedValue({ agent_id: "agent_1" });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("published");
    expect(mockGetLiveAgentConfig).toHaveBeenCalled();
    expect(mockPublishPrompt).toHaveBeenCalledWith(suggestion().suggestedPrompt);
    expect(repo.markPublished).toHaveBeenCalledOnce();
    expect(repo.recordRegressionResult).not.toHaveBeenCalled();
  });

  it("does not publish and marks failed_regression when a test fails", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: false, raw: { test_results: [{ result: "failure" }] } });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed_regression");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "failed_regression" }),
    );
  });

  it("does not publish when the run-tests response can't be confidently parsed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: null, raw: { unexpected: "shape" } });

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("pending");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("does not publish when publish itself throws, even after regression passed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: {} });
    mockGetLiveAgentConfig.mockResolvedValue({});
    mockPublishPrompt.mockRejectedValue(new Error("ElevenLabs 500"));

    const { service, repo } = buildService();
    const result = await service.approve(REVIEWER_ID, "sugg-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
    expect(repo.markPublished).not.toHaveBeenCalled();
  });
});

describe("PromptSuggestionService.consolidatePending", () => {
  it("returns a conflict when fewer than 2 pending suggestions with a suggested_prompt exist", async () => {
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(ok([suggestion({ category: "prompt" })])),
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
    expect(mockConsolidatePromptSuggestions).not.toHaveBeenCalled();
  });

  it("ignores suggestions with no suggested_prompt when counting candidates, regardless of category", async () => {
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(
        ok([
          suggestion({ id: "s1", category: "prompt" }),
          suggestion({ id: "s2", category: "knowledge_base", suggestedPrompt: null }),
        ]),
      ),
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
  });

  it("includes a non-'prompt' category suggestion when it carries a suggested_prompt", async () => {
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "live prompt text" } } });
    mockConsolidatePromptSuggestions.mockResolvedValue({ mergedPrompt: "merged text", summary: "summary text" });
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(
        ok([
          suggestion({ id: "s1", category: "prompt" }),
          suggestion({ id: "s2", category: "conversation_flow", suggestedPrompt: "flow fix prompt" }),
        ]),
      ),
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(true);
    expect(mockConsolidatePromptSuggestions).toHaveBeenCalledOnce();
  });

  it("merges 2+ pending prompt suggestions into one new suggestion and marks the originals merged", async () => {
    const s1 = suggestion({ id: "s1", category: "prompt", supportingCallReviewIds: ["r1", "r2"] });
    const s2 = suggestion({ id: "s2", category: "prompt", supportingCallReviewIds: ["r2", "r3"] });
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "live prompt text" } } });
    mockConsolidatePromptSuggestions.mockResolvedValue({ mergedPrompt: "merged text", summary: "summary text" });

    const createFromMerge = vi.fn().mockResolvedValue(
      ok(suggestion({ id: "merged-1", category: "prompt", suggestedPrompt: "merged text", mergedFromIds: ["s1", "s2"] })),
    );
    const markMerged = vi.fn().mockResolvedValue(ok(undefined));
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(ok([s1, s2])),
      createFromMerge,
      markMerged,
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe("merged-1");
    expect(mockConsolidatePromptSuggestions).toHaveBeenCalledWith({
      livePrompt: "live prompt text",
      suggestions: [
        { patternSummary: s1.patternSummary, proposedChange: s1.proposedChange, rootCause: s1.rootCause, suggestedPrompt: s1.suggestedPrompt },
        { patternSummary: s2.patternSummary, proposedChange: s2.proposedChange, rootCause: s2.rootCause, suggestedPrompt: s2.suggestedPrompt },
      ],
    });
    expect(createFromMerge).toHaveBeenCalledWith({
      clinicId: s1.clinicId,
      patternSummary: "איחוד 2 הצעות תיקון פתוחות",
      proposedChange: "summary text",
      suggestedPrompt: "merged text",
      supportingCallReviewIds: ["r1", "r2", "r3"],
      mergedFromIds: ["s1", "s2"],
    });
    expect(markMerged).toHaveBeenCalledWith(["s1", "s2"]);
  });

  it("returns externalProvider when fetching the live prompt fails, without calling the LLM", async () => {
    mockGetLiveAgentConfig.mockRejectedValue(new Error("ElevenLabs down"));
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(
        ok([suggestion({ id: "s1", category: "prompt" }), suggestion({ id: "s2", category: "prompt" })]),
      ),
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
    expect(mockConsolidatePromptSuggestions).not.toHaveBeenCalled();
  });

  it("returns externalProvider when the LLM call fails, without creating a row", async () => {
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "live" } } });
    mockConsolidatePromptSuggestions.mockRejectedValue(new Error("OpenAI down"));
    const createFromMerge = vi.fn();
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(
        ok([suggestion({ id: "s1", category: "prompt" }), suggestion({ id: "s2", category: "prompt" })]),
      ),
      createFromMerge,
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
    expect(createFromMerge).not.toHaveBeenCalled();
  });

  it("still returns ok with the new suggestion when markMerged fails (best-effort)", async () => {
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "live" } } });
    mockConsolidatePromptSuggestions.mockResolvedValue({ mergedPrompt: "merged", summary: "summary" });
    const created = suggestion({ id: "merged-1", category: "prompt" });
    const { service } = buildService({
      listByStatus: vi.fn().mockResolvedValue(
        ok([suggestion({ id: "s1", category: "prompt" }), suggestion({ id: "s2", category: "prompt" })]),
      ),
      createFromMerge: vi.fn().mockResolvedValue(ok(created)),
      markMerged: vi.fn().mockResolvedValue(err(AppError.externalProvider("db down"))),
    });

    const result = await service.consolidatePending();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe("merged-1");
  });
});
