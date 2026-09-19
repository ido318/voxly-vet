import { describe, expect, it } from "vitest";
import { getBookableDates } from "@/lib/appointment-rules";

describe("getBookableDates", () => {
  it("returns exactly 14 consecutive ISO dates starting today", () => {
    const dates = getBookableDates("2026-08-29");

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-08-29");
    expect(dates[13]).toBe("2026-09-11");
  });

  it("crosses a month boundary correctly", () => {
    const dates = getBookableDates("2026-08-20");

    expect(dates[0]).toBe("2026-08-20");
    expect(dates.at(-1)).toBe("2026-09-02");
  });
});
