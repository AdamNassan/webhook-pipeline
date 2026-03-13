export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "READINESS_FAILED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(params: { message: string; statusCode: number; code: ErrorCode; details?: unknown }) {
    super(params.message);
    this.name = "AppError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
