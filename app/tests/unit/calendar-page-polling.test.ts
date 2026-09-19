import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard calendar page live refresh", () => {
  it("polls appointments so externally booked slots appear without manual refresh", () => {
    const source = readFileSync(join(process.cwd(), "app/dashboard/calendar/page.tsx"), "utf8");

    expect(source).toContain("/api/calendar?clinicId=");
    expect(source).not.toContain("/api/appointments?from=");
    expect(source).toContain("petName");
    expect(source).toContain("customerName");
    expect(source).toContain("typeMark");
    expect(source).toContain('minHeight: "72px"');
    expect(source).toContain("HOUR_HEIGHT_PX = 150");
    expect(source).toContain("TIMELINE_HEIGHT_PX");
    expect(source).toContain("setInterval");
    expect(source).toContain("5000");
    expect(source).toContain("clearInterval");
    expect(source).toContain("visibilitychange");
  });
});
