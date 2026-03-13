import type { RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { AppError } from "../errors/app-error.js";

type ValidationSchemas = {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
};

export function validateRequest(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    const locals = req.res?.locals as {
      validated?: {
        params?: unknown;
        query?: unknown;
        body?: unknown;
      };
    };

    if (!locals.validated) {
      locals.validated = {};
    }

    const issues: Array<{ path: string; message: string }> = [];

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
      } else {
        locals.validated.params = parsed.data;
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
      } else {
        locals.validated.query = parsed.data;
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
      } else {
        locals.validated.body = parsed.data;
      }
    }

    if (issues.length > 0) {
      return next(
        new AppError({
          message: "Request validation failed",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: issues
        })
      );
    }

    next();
  };
}

export { z };
