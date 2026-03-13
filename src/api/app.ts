import express from "express";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createApiRouter } from "./routes/index.js";

export function buildApiApp() {
  const app = express();
  const startedAt = Date.now();

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as { rawBody?: string }).rawBody = buf.toString("utf8");
      }
    })
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-correlation-id"];
        const requestId = typeof incoming === "string" ? incoming : randomUUID();
        res.setHeader("x-correlation-id", requestId);
        return requestId;
      }
    })
  );

  app.use(createApiRouter(startedAt));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
