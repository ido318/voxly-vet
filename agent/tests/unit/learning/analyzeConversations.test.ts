import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ANTHROPIC_API_KEY default comes from tests/setup.ts (must be set before any
// module that calls getEnv() at import time — e.g. logger.ts — is evaluated).

const { mockFrom, callReviewsSelectResult, insertCalls, callReviewsEqClinicId, callReviewsEqIsException } =
  vi.hoisted(() => {
    const callReviewsSelectResult: { data: unknown[]; error: null } = { data: [], error: null };
    const insertedIds = ["suggestion-1", "suggestion-2", "suggestion-3"];
    const insertCalls: unknown[] = [];
    const callReviewsEqIsException = vi.fn(() => ({ gte: () => Promise.resolve(callReviewsSelectResult) }));
    const callReviewsEqClinicId = vi.fn(() => ({ eq: callReviewsEqIsException }));

    const mockFrom = vi.fn((table: string) => {
      if (table === "call_reviews") {
        return { select: () => ({ eq: callReviewsEqClinicId }) };
      }
      if (table === "tomer_prompt_suggestions") {
        return {
          insert: (row: unknown) => {
            insertCalls.push(row);
            const id = insertedIds[insertCalls.length - 1] ?? `suggestion-${insertCalls.length}`;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    return { mockFrom, callReviewsSelectResult, insertedIds, insertCalls, callReviewsEqClinicId, callReviewsEqIsException };
  });

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { analyzeConversations } from "../../../src/lib/learning/analyzeConversations.js";

function claudeResponse(pattern_summary: string, proposed_change: string, suggested_prompt: string | null = null) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ type: "text", text: JSON.stringify({ pattern_summary, proposed_change, suggested_prompt }) }],
      }),
  };
}

beforeEach(() => {
  mockFrom.mockClear();
  callReviewsSelectResult.data = [];
  insertCalls.length = 0;
  callReviewsEqClinicId.mockClear();
  callReviewsEqIsException.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeConversations", () => {
  it("no-ops when no group reaches the minimum of 2 occurrences", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "x", category: "prompt", target_file: "a.md" }], transcript_summary: null },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 1, groupsConsidered: 1, suggestionIds: [] });
    expect(mockFrom).not.toHaveBeenCalledWith("tomer_prompt_suggestions");
  });

  it("no-ops on zero flagged calls", async () => {
    const result = await analyzeConversations("clinic-1");
    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 0, groupsConsidered: 0, suggestionIds: [] });
  });

  it("filters call_reviews by clinic_id and is_exception", async () => {
    await analyzeConversations("clinic-1");
    expect(callReviewsEqClinicId).toHaveBeenCalledWith("clinic_id", "clinic-1");
    expect(callReviewsEqIsException).toHaveBeenCalledWith("is_exception", true);
  });

  it("throws a clear error when ANTHROPIC_API_KEY is not configured", async () => {
    vi.resetModules();
    const original = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];

    const { analyzeConversations: analyzeWithoutKey } = await import(
      "../../../src/lib/learning/analyzeConversations.js"
    );

    await expect(analyzeWithoutKey("clinic-1")).rejects.toThrow("ANTHROPIC_API_KEY");

    process.env["ANTHROPIC_API_KEY"] = original;
    vi.resetModules();
  });

  it("excludes no_change and unrecognized categories from grouping", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [
          { problem: "a", category: "no_change", target_file: "x.md" },
          { problem: "b", category: "not_a_real_category", target_file: "x.md" },
        ],
        transcript_summary: null,
      },
      { id: "r2", problems: [{ problem: "c", category: "no_change", target_file: "x.md" }], transcript_summary: null },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 2, groupsConsidered: 0, suggestionIds: [] });
  });

  it("groups by (category, target_file) and creates one suggestion per qualifying group", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [{ problem: "לא שאל שם", category: "conversation_flow", target_file: "prompt/booking_flow" }],
        transcript_summary: "s1",
      },
      {
        id: "r2",
        problems: [{ problem: "לא שאל שם שוב", category: "conversation_flow", target_file: "prompt/booking_flow" }],
        transcript_summary: "s2",
      },
      {
        id: "r3",
        problems: [{ problem: "מחיר שגוי", category: "knowledge_base", target_file: "kb/pricing_and_visits.md" }],
        transcript_summary: "s3",
      },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(claudeResponse("דפוס איסוף פרטים", "להוסיף שלב איסוף שם")));

    const result = await analyzeConversations("clinic-1");

    expect(result.ranAnalysis).toBe(true);
    expect(result.flaggedCallCount).toBe(3);
    expect(result.groupsConsidered).toBe(2);
    expect(result.suggestionIds).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      category: "conversation_flow",
      target_file: "prompt/booking_flow",
      suggested_prompt: null,
      supporting_call_review_ids: ["r1", "r2"],
    });
  });

  it("sets suggested_prompt only for category 'prompt'", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "חוזר על עצמו", category: "prompt" }], transcript_summary: "s1" },
      { id: "r2", problems: [{ problem: "חוזר על עצמו שוב", category: "prompt" }], transcript_summary: "s2" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(claudeResponse("חזרות מיותרות", "להוסיף כלל אנטי-חזרה", "פרומפט מתוקן מלא")),
    );

    await analyzeConversations("clinic-1");

    expect(insertCalls[0]).toMatchObject({
      category: "prompt",
      target_file: null,
      suggested_prompt: "פרומפט מתוקן מלא",
    });
  });

  it("continues to remaining groups when one group's Claude call fails", async () => {
    callReviewsSelectResult.data = [
      { id: "r1", problems: [{ problem: "a", category: "tool", target_file: "check-availability" }], transcript_summary: "s1" },
      { id: "r2", problems: [{ problem: "b", category: "tool", target_file: "check-availability" }], transcript_summary: "s2" },
      { id: "r3", problems: [{ problem: "c", category: "backend_logic", target_file: "scheduling" }], transcript_summary: "s3" },
      { id: "r4", problems: [{ problem: "d", category: "backend_logic", target_file: "scheduling" }], transcript_summary: "s4" },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("server error") })
      .mockResolvedValueOnce(claudeResponse("דפוס תזמון", "לתקן בדיקת זמינות"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeConversations("clinic-1");

    expect(result.ranAnalysis).toBe(true);
    expect(result.groupsConsidered).toBe(2);
    expect(result.suggestionIds).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
  });

  it("does not let a single call's multiple same-group problems alone satisfy the recurrence threshold", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [
          { problem: "בעיה א", category: "tool", target_file: "check-availability" },
          { problem: "בעיה ב", category: "tool", target_file: "check-availability" },
        ],
        transcript_summary: "s1",
      },
    ];

    const result = await analyzeConversations("clinic-1");

    expect(result).toEqual({ ranAnalysis: false, flaggedCallCount: 1, groupsConsidered: 1, suggestionIds: [] });
    expect(mockFrom).not.toHaveBeenCalledWith("tomer_prompt_suggestions");
  });

  it("dedupes supporting_call_review_ids when one call contributes multiple problems to the same group", async () => {
    callReviewsSelectResult.data = [
      {
        id: "r1",
        problems: [
          { problem: "בעיה א", category: "tool", target_file: "check-availability" },
          { problem: "בעיה ב", category: "tool", target_file: "check-availability" },
        ],
        transcript_summary: "s1",
      },
      {
        id: "r2",
        problems: [{ problem: "בעיה ג", category: "tool", target_file: "check-availability" }],
        transcript_summary: "s2",
      },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(claudeResponse("דפוס", "תיקון")));

    const result = await analyzeConversations("clinic-1");

    expect(result.suggestionIds).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      supporting_call_review_ids: ["r1", "r2"],
    });
  });
});
