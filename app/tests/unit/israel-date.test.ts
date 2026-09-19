import { describe, expect, it } from "vitest";
import {
  formatIsraelDate,
  formatIsraelDateTime,
  formatIsraelTime,
  israelDayUtcRange,
  israelDateIso,
} from "@/lib/israel-date";

describe("israelDateIso", () => {
  it("מקבץ תור לפי תאריך ישראל גם כשה-UTC ביום הקודם", () => {
    expect(israelDateIso("2026-06-21T22:30:00.000Z")).toBe("2026-06-22");
  });
});

describe("Israel date/time display formatting", () => {
  it("formats time in 24-hour Israel time", () => {
    expect(formatIsraelTime("2026-06-20T10:00:00.000Z")).toBe("13:00");
  });

  it("formats dates as dd/mm/yy", () => {
    expect(formatIsraelDate("2026-06-20T10:00:00.000Z")).toBe("20/06/26");
  });

  it("formats date and time together without 12-hour clock", () => {
    expect(formatIsraelDateTime("2026-06-20T10:00:00.000Z")).toBe("20/06/26 13:00");
  });
});

describe("israelDayUtcRange", () => {
  it("converts an Israel summer date to a full UTC datetime range", () => {
    expect(israelDayUtcRange("2026-08-29")).toEqual({
      from: "2026-08-28T21:00:00.000Z",
      to: "2026-08-29T21:00:00.000Z",
    });
  });

  it("converts an Israel winter date to a full UTC datetime range", () => {
    expect(israelDayUtcRange("2026-01-10")).toEqual({
      from: "2026-01-09T22:00:00.000Z",
      to: "2026-01-10T22:00:00.000Z",
    });
  });
});
