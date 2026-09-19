import { describe, expect, it, vi, beforeEach } from "vitest";
import { CallReviewRepository } from "@/lib/repositories/call-review.repository";

function buildListQuery(result: { data: unknown[] | null; error: unknown; count: number | null }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  return query;
}

const row = {
  id: "cr-1",
  clinic_id: "clinic-1",
  conversation_id: "conv_1",
  agent_id: "agent_1",
  version_id: null,
  call_successful: "success",
  transcript_summary: "summary",
  evaluation_criteria_results: {},
  data_collection_results: {},
  flagged: false,
  flagged_reasons: [],
  transcript: [],
  call_duration_secs: 90,
  qa_analyzed_at: "2026-08-31T17:30:56.000Z",
  overall_score: "6.00",
  empathy_score: "6.00",
  naturalness_score: "5.00",
  accuracy_score: "6.00",
  protocol_score: "5.00",
  safety_score: "9.00",
  resolution_score: "7.00",
  is_exception: true,
  exception_severity: "medium",
  strengths: [],
  problems: [{ problem: "x", category: "conversation_flow" }],
  reviewer_summary: "review",
  analyzer_model: "claude-sonnet-5",
  created_at: "2026-08-31T17:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CallReviewRepository.listRecent", () => {
  it("maps rows, applies the since/severity filters, and returns the total count", async () => {
    const query = buildListQuery({ data: [row], error: null, count: 1 });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.listRecent({ sinceDays: 30, severity: "medium", limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.items[0]).toMatchObject({ id: "cr-1", overallScore: 6, isException: true, exceptionSeverity: "medium" });
    expect(query.eq).toHaveBeenCalledWith("exception_severity", "medium");
    expect(query.order).toHaveBeenNthCalledWith(1, "is_exception", { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(0, 49);
  });

  it("skips the severity filter when severity is 'all'", async () => {
    const query = buildListQuery({ data: [], error: null, count: 0 });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    await repo.listRecent({ sinceDays: 30, severity: "all", limit: 50, offset: 0 });

    expect(query.eq).not.toHaveBeenCalled();
  });

  it("returns an externalProvider error when the query fails", async () => {
    const query = buildListQuery({ data: null, error: { message: "db down" }, count: null });
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.listRecent({ sinceDays: 30, severity: "all", limit: 50, offset: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
  });
});

describe("CallReviewRepository.findById", () => {
  it("maps a found row", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.findById("cr-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.id).toBe("cr-1");
    expect(query.eq).toHaveBeenCalledWith("id", "cr-1");
  });

  it("returns null when no row matches", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    const repo = new CallReviewRepository(client as never);

    const result = await repo.findById("missing");

    expect(result).toEqual({ ok: true, value: null });
  });
});
