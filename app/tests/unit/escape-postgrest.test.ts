import { describe, expect, it } from "vitest";
import {
  escapeIlikeWildcards,
  postgrestOrIlikeValue,
  quotePostgrestFilterValue,
} from "@/lib/search/escape-postgrest";

describe("escape-postgrest", () => {
  it("escapes LIKE wildcards so % and _ are literals", () => {
    expect(escapeIlikeWildcards("100%_off")).toBe("100\\%\\_off");
    expect(escapeIlikeWildcards("a\\b")).toBe("a\\\\b");
  });

  it("quotes values so commas, dots, and parentheses cannot split .or()", () => {
    expect(quotePostgrestFilterValue("a,b")).toBe('"a,b"');
    expect(quotePostgrestFilterValue("a.b")).toBe('"a.b"');
    expect(quotePostgrestFilterValue("a(b)")).toBe('"a(b)"');
    expect(quotePostgrestFilterValue('say "hi"')).toBe('"say \\"hi\\""');
  });

  it("builds a quoted ilike pattern wrapping the escaped query", () => {
    expect(postgrestOrIlikeValue("foo,bar")).toBe('"%foo,bar%"');
    expect(postgrestOrIlikeValue("100%")).toBe('"%100\\%%"');
    expect(postgrestOrIlikeValue("x_y")).toBe('"%x\\_y%"');
    expect(postgrestOrIlikeValue("and(or)")).toBe('"%and(or)%"');
  });
});
