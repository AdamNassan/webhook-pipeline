import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { webhookJobQueue } from "../queue/queues.js";
import { buildApiApp } from "./app.js";

const app = buildApiApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API server started");
});

server.on("error", (error) => {
  logger.error({ err: error }, "API server encountered an error");
});

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "API shutdown started");

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await Promise.allSettled([
    webhookJobQueue.close(),
    prisma.$disconnect()
  ]);

  logger.info("API shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception in API process");
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection in API process");
  void shutdown("unhandledRejection");
});
