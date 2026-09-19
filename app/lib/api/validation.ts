import { ZodSchema } from "zod";
import { AppError } from "@/lib/errors/app-error";

export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppError.validation("Validation failed", result.error.flatten());
  }
  return result.data;
}
