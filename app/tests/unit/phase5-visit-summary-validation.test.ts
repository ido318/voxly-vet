import { describe, expect, it } from "vitest";
import { acceptVisitSummarySchema } from "@/lib/validators/visit-ai-summary";

describe("phase5 visit summary validation", () => {
  it("accepts valid accept payload", () => {
    const result = acceptVisitSummarySchema.safeParse({
      version: 1,
      summaryText: "Patient presented for checkup.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty summary text", () => {
    const result = acceptVisitSummarySchema.safeParse({
      version: 0,
      summaryText: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = acceptVisitSummarySchema.safeParse({
      summaryText: "Summary",
    });
    expect(result.success).toBe(false);
  });
});
