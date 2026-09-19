import { describe, it, expect, vi, afterEach } from "vitest";
import { callClaudeForJson } from "../../../src/lib/learning/claudeJson.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callClaudeForJson", () => {
  it("parses plain JSON returned in the text content block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: '{"foo":"bar"}' }] }),
      }),
    );

    const result = await callClaudeForJson("key", "system", { input: 1 });
    expect(result).toEqual({ foo: "bar" });
  });

  it("strips a markdown json fence before parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ type: "text", text: '```json\n{"foo":"bar"}\n```' }],
          }),
      }),
    );

    const result = await callClaudeForJson("key", "system", {});
    expect(result).toEqual({ foo: "bar" });
  });

  it("throws with the response body when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("server error") }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API request failed (500): server error",
    );
  });

  it("throws when there is no text content block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ content: [] }) }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API returned no text content",
    );
  });

  it("throws when the text content is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: "text", text: "not json" }] }),
      }),
    );

    await expect(callClaudeForJson("key", "system", {})).rejects.toThrow(
      "Anthropic API returned non-JSON content",
    );
  });
});
