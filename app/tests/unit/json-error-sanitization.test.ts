import { afterEach, describe, expect, it, vi } from "vitest";
import { detailsForClient, jsonError } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";

describe("jsonError sanitization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits EXTERNAL_PROVIDER_ERROR details from the client body and logs them with requestId", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = AppError.externalProvider("Invoice provider failed", {
      status: 500,
      statusText: "Internal Server Error",
      body: { secret: "upstream-token" },
    });

    const response = jsonError(error, "req-123");
    const payload = await response.json();

    expect(payload.error.code).toBe("EXTERNAL_PROVIDER_ERROR");
    expect(payload.error.message).toBe("Invoice provider failed");
    expect(payload.error.details).toBeUndefined();
    expect(payload.requestId).toBe("req-123");
    expect(log).toHaveBeenCalledWith(
      "[api] error details",
      expect.objectContaining({
        requestId: "req-123",
        code: "EXTERNAL_PROVIDER_ERROR",
        details: expect.objectContaining({ body: { secret: "upstream-token" } }),
      }),
    );
  });

  it("keeps Zod flatten validation details for the client", () => {
    const error = AppError.validation("Validation failed", {
      formErrors: [],
      fieldErrors: { email: ["Required"] },
    });

    expect(detailsForClient(error)).toEqual({
      formErrors: [],
      fieldErrors: { email: ["Required"] },
    });
  });

  it("keeps conflict details that are not provider payloads", () => {
    const error = AppError.conflict("Duplicate customer", {
      duplicates: [{ id: "c1", fullName: "Dana" }],
    });

    expect(detailsForClient(error)).toEqual({
      duplicates: [{ id: "c1", fullName: "Dana" }],
    });
  });

  it("strips provider-like details even on non-provider codes", () => {
    const error = AppError.conflict("Could not save", {
      response: { headers: { authorization: "Bearer leaked" } },
    });

    expect(detailsForClient(error)).toBeUndefined();
  });

  it("never returns INTERNAL_ERROR details", () => {
    const error = AppError.internal("boom", { stack: "Error: boom" });
    expect(detailsForClient(error)).toBeUndefined();
  });
});
