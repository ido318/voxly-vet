import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("today dashboard API requests", () => {
  it("uses a UTC datetime range for today's voice calls request", () => {
    const source = readFileSync(join(process.cwd(), "app/dashboard/page.tsx"), "utf8");

    expect(source).toContain("israelDayUtcRange(today)");
    expect(source).toContain("encodeURIComponent(callRange.from)");
    expect(source).toContain("encodeURIComponent(callRange.to)");
    expect(source).not.toContain("fetch(`/api/voice/calls?from=${today}&to=${today}`)");
  });
});
