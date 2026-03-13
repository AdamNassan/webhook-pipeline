import type { ErrorRequestHandler } from "express";
import { logger } from "../../lib/logger.js";
import { AppError, isAppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const correlationId = res.getHeader("x-correlation-id") || req.id;

  if (isAppError(error)) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        correlationId
      }
    });
  }

  logger.error({ err: error, correlationId }, "Unhandled API error");

  const internalError = new AppError({
    message: "Internal server error",
    statusCode: 500,
    code: "INTERNAL_ERROR"
  });

  return res.status(500).json({
    error: {
      code: internalError.code,
      message: internalError.message,
      correlationId
    }
  });
};
