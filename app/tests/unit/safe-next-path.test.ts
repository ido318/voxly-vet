import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it("defaults to /dashboard when value is missing", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("uses a custom fallback when the path is invalid", () => {
    expect(safeNextPath("https://evil.example", "/login/reset-password")).toBe(
      "/login/reset-password",
    );
  });

  it("allows a single-slash internal path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/customers")).toBe("/dashboard/customers");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("///evil.example")).toBe("/dashboard");
    expect(safeNextPath("http://evil.example")).toBe("/dashboard");
    expect(safeNextPath("https://evil.example/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\\\evil.example")).toBe("/dashboard");
  });

  it("rejects javascript: and other schemes", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("data:text/html,hi")).toBe("/dashboard");
  });

  it("rejects encoded open-redirect tricks", () => {
    expect(safeNextPath("/%2f%2fevil.example")).toBe("/dashboard");
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/dashboard");
    expect(safeNextPath("/%5cevil.example")).toBe("/dashboard");
    expect(safeNextPath("/%09/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/%00/dashboard")).toBe("/dashboard");
  });

  it("rejects query, hash, whitespace, and control characters", () => {
    expect(safeNextPath("/dashboard?next=https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("/dashboard#/evil")).toBe("/dashboard");
    expect(safeNextPath(" /dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard ")).toBe("/dashboard");
  });
});
