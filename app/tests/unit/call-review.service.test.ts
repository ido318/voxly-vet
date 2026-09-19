import { describe, expect, it, vi } from "vitest";
import { AppError, ok, err } from "@/lib/errors/app-error";
import { CallReviewService } from "@/lib/services/call-review.service";

const review = { id: "cr-1", clinicId: "c1" } as never;
const suggestion = { id: "sugg-1", supportingCallReviewIds: ["cr-1"] } as never;

describe("CallReviewService", () => {
  it("list() delegates to the repository with a 30-day window and 50-item pages", async () => {
    const listRecent = vi.fn().mockResolvedValue(ok({ items: [review], total: 1 }));
    const service = new CallReviewService(
      { listRecent } as never,
      { findBySupportingCallReviewId: vi.fn() } as never,
    );

    await service.list({ severity: "medium", page: 2 });

    expect(listRecent).toHaveBeenCalledWith({ sinceDays: 30, severity: "medium", limit: 50, offset: 50 });
  });

  it("getWithLinkedSuggestion() returns null when the review does not exist", async () => {
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(ok(null)) } as never,
      { findBySupportingCallReviewId: vi.fn() } as never,
    );

    const result = await service.getWithLinkedSuggestion("missing");

    expect(result).toEqual(ok(null));
  });

  it("getWithLinkedSuggestion() attaches the linked suggestion when found", async () => {
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(ok(review)) } as never,
      { findBySupportingCallReviewId: vi.fn().mockResolvedValue(ok(suggestion)) } as never,
    );

    const result = await service.getWithLinkedSuggestion("cr-1");

    expect(result).toEqual(ok({ review, linkedSuggestion: suggestion }));
  });

  it("getWithLinkedSuggestion() propagates a findById error", async () => {
    const findByIdError = err(AppError.externalProvider("db down"));
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(findByIdError) } as never,
      { findBySupportingCallReviewId: vi.fn() } as never,
    );

    const result = await service.getWithLinkedSuggestion("cr-1");

    expect(result).toEqual(findByIdError);
  });

  it("getWithLinkedSuggestion() propagates a findBySupportingCallReviewId error", async () => {
    const suggestionError = err(AppError.externalProvider("db down"));
    const service = new CallReviewService(
      { findById: vi.fn().mockResolvedValue(ok(review)) } as never,
      { findBySupportingCallReviewId: vi.fn().mockResolvedValue(suggestionError) } as never,
    );

    const result = await service.getWithLinkedSuggestion("cr-1");

    expect(result).toEqual(suggestionError);
  });
});
