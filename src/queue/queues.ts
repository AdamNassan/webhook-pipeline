import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import type { WebhookJobPayload } from "./contracts.js";

export const WEBHOOK_JOB_QUEUE_NAME = "webhook-job-queue";

export const webhookJobQueue = new Queue<WebhookJobPayload>(WEBHOOK_JOB_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: 200,
    removeOnFail: 200
  }
});
