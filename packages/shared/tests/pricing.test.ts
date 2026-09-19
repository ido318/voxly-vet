import { describe, expect, it } from "vitest";
import {
  NO_QUOTABLE_PRICE_TEXT,
  formatPriceSegment,
  resolvePriceSegment,
} from "../src/pricing";

describe("resolvePriceSegment", () => {
  it("quotes a normal price", () => {
    expect(resolvePriceSegment({ defaultPrice: 150, agentQuotable: true })).toBe("150 ₪");
  });

  // The case this module exists for. 350 is real and Dana bills by it, but the
  // price depends on the individual animal, so Tomer must not name it.
  it("withholds a price the agent may not quote, even though one exists", () => {
    expect(resolvePriceSegment({ defaultPrice: 350, agentQuotable: false })).toBe(
      NO_QUOTABLE_PRICE_TEXT,
    );
  });

  // The old code did `VISIT_PRICES[type] ?? "150 ₪"` — a number nobody
  // configured, texted to a client as a commitment.
  it("never invents a price for a visit type the clinic has not configured", () => {
    expect(resolvePriceSegment(undefined)).toBe(NO_QUOTABLE_PRICE_TEXT);
    expect(resolvePriceSegment(undefined)).not.toMatch(/\d/);
  });
});

describe("formatPriceSegment", () => {
  it("drops trailing zeros on whole shekels", () => {
    expect(formatPriceSegment(150)).toBe("150 ₪");
    expect(formatPriceSegment(150.0)).toBe("150 ₪");
  });

  it("keeps agorot when the clinic entered them", () => {
    expect(formatPriceSegment(149.9)).toBe("149.90 ₪");
  });
});
