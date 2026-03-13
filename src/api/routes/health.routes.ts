import { Router } from "express";
import { AppError } from "../errors/app-error.js";
import { checkReadiness } from "../services/readiness.service.js";

export function createHealthRouter(startedAt: number) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "api",
      uptimeMs: Date.now() - startedAt
    });
  });

  router.get("/ready", async (_req, res, next) => {
    try {
      const readiness = await checkReadiness();
      if (!readiness.ok) {
        return next(
          new AppError({
            message: "Dependency readiness check failed",
            statusCode: 503,
            code: "READINESS_FAILED",
            details: readiness.checks
          })
        );
      }

      return res.status(200).json({
        status: "ready",
        checks: readiness.checks
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
