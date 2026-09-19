import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
  return { mockUpsert, mockFrom };
});

vi.mock("../../../src/lib/supabase.js", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { logConversation } from "../../../src/lib/learning/logConversation.js";

beforeEach(() => {
  mockUpsert.mockClear();
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockClear();
});

describe("logConversation", () => {
  it("flags the call when a criterion result is 'failure'", async () => {
    await logConversation("conv_1", "clinic_1", {
      agent_id: "agent_1",
      analysis: {
        evaluation_criteria_results: {
          natural_hebrew: { result: "success", rationale: "ok" },
          no_forbidden_phrases: { result: "failure", rationale: "used a forbidden phrase" },
        },
      },
    });

    expect(mockFrom).toHaveBeenCalledWith("call_reviews");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: "clinic_1",
        conversation_id: "conv_1",
        agent_id: "agent_1",
        flagged: true,
        flagged_reasons: ["no_forbidden_phrases"],
      }),
      { onConflict: "conversation_id" },
    );
  });

  it("does not flag the call when every criterion succeeds", async () => {
    await logConversation("conv_2", "clinic_1", {
      agent_id: "agent_1",
      analysis: {
        evaluation_criteria_results: {
          natural_hebrew: { result: "success" },
          emotional_mirroring: { result: "success" },
        },
      },
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ flagged: false, flagged_reasons: [] }),
      { onConflict: "conversation_id" },
    );
  });

  it("falls back to the env agent id and empty transcript when the payload has no analysis object", async () => {
    await expect(logConversation("conv_3", "clinic_1", {})).resolves.toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: expect.any(String),
        transcript: [],
        evaluation_criteria_results: {},
        flagged: false,
      }),
      { onConflict: "conversation_id" },
    );
  });

  it("maps agent_id, version_id, call_successful, transcript, and call_duration_secs from the payload", async () => {
    await logConversation("conv_5", "clinic_1", {
      agent_id: "agent_9",
      version_id: "version_9",
      transcript: [{ role: "user", message: "היי" }],
      metadata: { call_duration_secs: 42 },
      analysis: {
        call_successful: "success",
        transcript_summary: "סיכום קצר",
        evaluation_criteria_results: {},
        data_collection_results: { customer_name: { value: "דנה" } },
      },
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: "agent_9",
        version_id: "version_9",
        transcript: [{ role: "user", message: "היי" }],
        call_duration_secs: 42,
        call_successful: "success",
        transcript_summary: "סיכום קצר",
        data_collection_results: { customer_name: { value: "דנה" } },
      }),
      { onConflict: "conversation_id" },
    );
  });

  it("swallows a Supabase error instead of throwing", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "db down" } });
    await expect(
      logConversation("conv_4", "clinic_1", {
        agent_id: "agent_1",
        analysis: { evaluation_criteria_results: {} },
      }),
    ).resolves.toBeUndefined();
  });
});
