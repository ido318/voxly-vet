import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Next.js proxy convention", () => {
  it("uses proxy.ts instead of the deprecated middleware.ts convention", () => {
    const root = process.cwd();
    const proxyPath = join(root, "proxy.ts");
    const middlewarePath = join(root, "middleware.ts");

    expect(existsSync(proxyPath)).toBe(true);
    expect(existsSync(middlewarePath)).toBe(false);

    const source = readFileSync(proxyPath, "utf8");
    expect(source).toContain("export async function proxy");
    expect(source).toContain("matcher: [\"/dashboard/:path*\", \"/login\"]");
  });
});
