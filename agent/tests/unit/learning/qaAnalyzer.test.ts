import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockEq, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ update: mockUpdate }));
  return { mockEq, mockUpdate, mockFrom };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { analyzeCallQuality } from "../../../src/lib/learning/qaAnalyzer.js";

const VALID_PAYLOAD = {
  transcript: [
    { role: "agent", message: "שלום, איך אפשר לעזור?" },
    { role: "user", message: "הכלב שלי מקיא" },
  ],
};

const GOOD_RESULT = {
  // safety must clear the deterministic threshold (safety_score < 9 forces
  // is_exception per DETERMINISTIC_THRESHOLDS), so it's 9 here while the other
  // dimensions stay at 8 to keep this fixture representative of "a good call".
  scores: { overall: 8, empathy: 8, naturalness: 8, accuracy: 8, protocol: 8, safety: 9, resolution: 8 },
  is_exception: false,
  exception_severity: "none",
  strengths: ["שאל שאלות רלוונטיות"],
  problems: [],
  summary: "שיחה תקינה",
};

function mockClaudeResponse(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    }),
  );
}

beforeEach(() => {
  mockEq.mockClear();
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockClear();
  mockFrom.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeCallQuality", () => {
  it("updates the QA scores onto call_reviews by conversation_id", async () => {
    mockClaudeResponse(GOOD_RESULT);

    await analyzeCallQuality("conv_1", VALID_PAYLOAD);

    expect(mockFrom).toHaveBeenCalledWith("call_reviews");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        overall_score: 8,
        empathy_score: 8,
        is_exception: false,
        exception_severity: "none",
        strengths: ["שאל שאלות רלוונטיות"],
        reviewer_summary: "שיחה תקינה",
        analyzer_model: "claude-sonnet-5",
      }),
    );
    expect(mockEq).toHaveBeenCalledWith("conversation_id", "conv_1");
  });

  it("forces is_exception when safety_score falls below the deterministic threshold, even if the model said false", async () => {
    mockClaudeResponse({
      ...GOOD_RESULT,
      scores: { ...GOOD_RESULT.scores, safety: 5 },
      is_exception: false,
      exception_severity: "none",
    });

    await analyzeCallQuality("conv_2", VALID_PAYLOAD);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_exception: true, exception_severity: "medium" }),
    );
  });

  it("keeps a higher model-reported severity when a threshold is also breached", async () => {
    mockClaudeResponse({
      ...GOOD_RESULT,
      scores: { ...GOOD_RESULT.scores, overall: 5 },
      is_exception: true,
      exception_severity: "critical",
    });

    await analyzeCallQuality("conv_3", VALID_PAYLOAD);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_exception: true, exception_severity: "critical" }),
    );
  });

  it("does not write anything when Claude's response is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: "not json" }] }),
      }),
    );

    await expect(analyzeCallQuality("conv_4", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not write anything when Claude's JSON is missing required fields", async () => {
    mockClaudeResponse({ scores: { overall: 8 } });

    await expect(analyzeCallQuality("conv_5", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not throw when the Claude request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("boom") }),
    );

    await expect(analyzeCallQuality("conv_6", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not throw when the Supabase update fails", async () => {
    mockClaudeResponse(GOOD_RESULT);
    mockEq.mockResolvedValueOnce({ error: { message: "db down" } });

    await expect(analyzeCallQuality("conv_7", VALID_PAYLOAD)).resolves.toBeUndefined();
  });

  it("skips analysis without calling Claude when the transcript is empty", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await analyzeCallQuality("conv_8", { transcript: [] });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("logs and returns without calling Claude when ANTHROPIC_API_KEY is not configured", async () => {
    vi.resetModules();
    const original = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { analyzeCallQuality: analyzeWithoutKey } = await import(
      "../../../src/lib/learning/qaAnalyzer.js"
    );

    await expect(analyzeWithoutKey("conv_9", VALID_PAYLOAD)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env["ANTHROPIC_API_KEY"] = original;
    vi.resetModules();
  });
});
