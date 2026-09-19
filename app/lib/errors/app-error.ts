export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  EXTERNAL_PROVIDER_ERROR: "EXTERNAL_PROVIDER_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(ErrorCodes.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(ErrorCodes.FORBIDDEN, message, 403);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(ErrorCodes.NOT_FOUND, message, 404);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(ErrorCodes.CONFLICT, message, 409, details);
  }

  static externalProvider(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorCodes.EXTERNAL_PROVIDER_ERROR,
      message,
      502,
      details,
    );
  }

  static serviceUnavailable(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorCodes.EXTERNAL_PROVIDER_ERROR,
      message,
      503,
      details,
    );
  }

  static internal(message = "Internal server error", details?: unknown): AppError {
    return new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details);
  }
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: AppError): Result<T> {
  return { ok: false, error };
}
