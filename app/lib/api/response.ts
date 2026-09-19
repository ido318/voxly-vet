import { NextResponse } from "next/server";
import { AppError, ErrorCodes } from "@/lib/errors/app-error";

const PROVIDERISH_DETAIL_KEYS = new Set([
  "body",
  "cause",
  "config",
  "headers",
  "html",
  "raw",
  "request",
  "response",
  "stack",
  "upstream",
]);

export function jsonSuccess<T>(data: T, status = 200, requestId?: string) {
  return NextResponse.json(
    { data, ...(requestId ? { requestId } : {}) },
    { status },
  );
}

export function jsonError(error: AppError, requestId?: string) {
  if (error.details !== undefined) {
    console.error("[api] error details", {
      requestId: requestId ?? null,
      code: error.code,
      details: error.details,
    });
  }

  const details = detailsForClient(error);

  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(details !== undefined ? { details } : {}),
      },
      ...(requestId ? { requestId } : {}),
    },
    { status: error.status },
  );
}

export function handleRouteError(error: unknown, requestId?: string) {
  if (error instanceof AppError) {
    return jsonError(error, requestId);
  }

  if (error instanceof SyntaxError) {
    return jsonError(AppError.validation("Invalid JSON body"), requestId);
  }

  console.error("[api] unhandled error", error);
  return jsonError(AppError.internal(), requestId);
}

/** Exported for unit tests. */
export function detailsForClient(error: AppError): unknown | undefined {
  if (error.details === undefined) {
    return undefined;
  }

  if (
    error.code === ErrorCodes.EXTERNAL_PROVIDER_ERROR ||
    error.code === ErrorCodes.INTERNAL_ERROR
  ) {
    return undefined;
  }

  if (looksLikeProviderPayload(error.details)) {
    return undefined;
  }

  return error.details;
}

function looksLikeProviderPayload(details: unknown): boolean {
  if (details == null) {
    return false;
  }

  if (typeof details === "string") {
    return details.length > 500 || /<\/?[a-z][\s\S]*>/i.test(details);
  }

  if (Array.isArray(details)) {
    return details.some(looksLikeProviderPayload);
  }

  if (typeof details !== "object") {
    return false;
  }

  const record = details as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => PROVIDERISH_DETAIL_KEYS.has(key.toLowerCase()))) {
    return true;
  }

  if ("status" in record && "statusText" in record) {
    return true;
  }

  return Object.values(record).some(
    (value) => value !== null && typeof value === "object" && looksLikeProviderPayload(value),
  );
}
