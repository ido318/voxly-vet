import { describe, expect, it } from "vitest";
import {
  createCalendarBlockSchema,
  listCalendarBlocksSchema,
} from "@/lib/validators/calendar-block";

describe("calendar block validators", () => {
  it("accepts Israel timezone offsets from the dashboard calendar form", () => {
    const result = createCalendarBlockSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      startAt: "2026-06-21T09:00:00+03:00",
      endAt: "2026-06-21T13:00:00+03:00",
      reason: "סיום מוקדם",
    });

    expect(result.success).toBe(true);
  });

  it("accepts Israel timezone offsets for list ranges", () => {
    const result = listCalendarBlocksSchema.safeParse({
      from: "2026-06-21T00:00:00+03:00",
      to: "2026-06-27T23:59:00+03:00",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a block that ends before it starts", () => {
    const result = createCalendarBlockSchema.safeParse({
      clinicId: "00000000-0000-4000-8000-000000000001",
      startAt: "2026-06-21T13:00:00+03:00",
      endAt: "2026-06-21T09:00:00+03:00",
      reason: "סיום מוקדם",
    });

    expect(result.success).toBe(false);
  });
});
