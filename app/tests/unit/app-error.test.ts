import { describe, expect, it } from "vitest";
import { AppError, ErrorCodes } from "@/lib/errors/app-error";

describe("AppError", () => {
  it("creates validation errors with correct status", () => {
    const error = AppError.validation("Invalid input", { field: "email" });

    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ field: "email" });
  });

  it("creates unauthorized errors", () => {
    const error = AppError.unauthorized();

    expect(error.status).toBe(401);
  });
});
