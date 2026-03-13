import { Worker } from "bullmq";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { redisConnection } from "../queue/connection.js";
import type { WebhookJobPayload } from "../queue/contracts.js";
import { WEBHOOK_JOB_QUEUE_NAME } from "../queue/queues.js";
import { processWebhookJob } from "./process-webhook-job.js";

const worker = new Worker<WebhookJobPayload>(
  WEBHOOK_JOB_QUEUE_NAME,
  async (job) => {
    logger.info({ queueJobId: job.id, payload: job.data }, "Worker picked queued job");
    return processWebhookJob(job.id, job.data);
  },
  { connection: redisConnection }
);

void worker.waitUntilReady().then(() => {
  logger.info("Worker connection is ready");
});

worker.on("completed", (job) => {
  logger.info({ queueJobId: job.id }, "Worker completed job");
});

worker.on("failed", (job, error) => {
  logger.error({ queueJobId: job?.id, error }, "Worker failed job");
});

logger.info("Worker started");

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Worker shutdown started");

  await Promise.allSettled([
    worker.close(),
    prisma.$disconnect()
  ]);

  logger.info("Worker shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception in worker process");
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection in worker process");
  void shutdown("unhandledRejection");
});
