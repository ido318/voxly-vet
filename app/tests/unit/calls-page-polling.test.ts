import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard calls page live refresh", () => {
  it("polls the voice calls API so active calls appear without manual refresh", () => {
    const source = readFileSync(join(process.cwd(), "app/dashboard/calls/page.tsx"), "utf8");

    expect(source).toContain("setInterval");
    expect(source).toContain("15000");
    expect(source).toContain("clearInterval");
  });
});
