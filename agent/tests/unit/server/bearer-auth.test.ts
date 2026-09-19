import { describe, expect, it } from "vitest";
import { isValidBearerToken } from "../../../src/server/middleware/bearerAuth.js";

describe("isValidBearerToken", () => {
  it("accepts only an exact Bearer token match", () => {
    expect(isValidBearerToken("Bearer secret-token-123", "secret-token-123")).toBe(true);
    expect(isValidBearerToken("Bearer wrong-token-123", "secret-token-123")).toBe(false);
    expect(isValidBearerToken("secret-token-123", "secret-token-123")).toBe(false);
    expect(isValidBearerToken(null, "secret-token-123")).toBe(false);
  });
});
