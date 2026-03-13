import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError({
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
      code: "NOT_FOUND"
    })
  );
};
