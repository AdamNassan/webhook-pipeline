import http from "node:http";
import { once } from "node:events";
import request from "supertest";
import { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApiApp } from "../../src/api/app";
import { prisma } from "../../src/lib/prisma";
import { redisConnection } from "../../src/queue/connection";
import type { WebhookJobPayload } from "../../src/queue/contracts";
import { WEBHOOK_JOB_QUEUE_NAME } from "../../src/queue/queues";
import { processWebhookJob } from "../../src/worker/process-webhook-job";
import { resetTestState } from "../helpers/db";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("E2E pipeline flow", () => {
  const app = buildApiApp();
  const deliveries: string[] = [];
  let stubServer: http.Server;
  let worker: Worker<WebhookJobPayload>;

  beforeAll(async () => {
    await prisma.$connect();

    stubServer = http.createServer(async (req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      await once(req, "end");

      deliveries.push(body);
      res.statusCode = 200;
      res.end("ok");
    });

    await new Promise<void>((resolve) => {
      stubServer.listen(4020, "127.0.0.1", () => resolve());
    });

    worker = new Worker<WebhookJobPayload>(
      WEBHOOK_JOB_QUEUE_NAME,
      async (job) => processWebhookJob(job.id, job.data),
      { connection: redisConnection }
    );

    await worker.waitUntilReady();
  });

  beforeEach(async () => {
    deliveries.length = 0;
    if (worker) {
      await worker.pause(true);
    }
    await resetTestState();
    if (worker) {
      await worker.resume();
    }
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    if (stubServer) {
      stubServer.close();
    }
    await prisma.$disconnect();
  });

  it("creates pipeline, ingests webhook, worker processes, and records subscriber delivery attempts", async () => {
    const pipeline = await request(app).post("/api/pipelines").send({ name: "E2E Pipeline" }).expect(201);
    const pipelineId = pipeline.body.data.id as string;
    const token = pipeline.body.data.sourceToken as string;

    await request(app)
      .post(`/api/pipelines/${pipelineId}/actions`)
      .send({ type: "transform", actionOrder: 1, config: { defaults: { stage: "e2e" } } })
      .expect(201);

    await request(app)
      .post(`/api/pipelines/${pipelineId}/subscribers`)
      .send({ targetUrl: "http://127.0.0.1:4020/ok", maxRetries: 2, timeoutMs: 3000 })
      .expect(201);

    const webhookResponse = await request(app)
      .post(`/webhooks/${token}`)
      .set("x-idempotency-key", "e2e-1")
      .send({ event: "e2e.event" })
      .expect(202);

    const jobId = webhookResponse.body.data.jobId as string;

    let finalStatus = "queued";
    for (let index = 0; index < 100; index += 1) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      finalStatus = job?.status ?? "queued";
      if (finalStatus === "succeeded" || finalStatus === "failed" || finalStatus === "dropped") {
        break;
      }
      await sleep(200);
    }

    expect(finalStatus).toBe("succeeded");

    const history = await request(app).get(`/api/jobs/${jobId}/history`).expect(200);
    expect(history.body.data.actionRuns.length).toBeGreaterThan(0);
    const attempts = history.body.data.deliveryAttempts as Array<{ status: string }>;
    expect(attempts.length).toBeGreaterThan(0);

    const hasDelivered = attempts.some((entry) => entry.status === "delivered");
    const hasTerminalFailure = attempts.some((entry) => entry.status === "failed");
    expect(hasDelivered || hasTerminalFailure).toBe(true);

    if (hasDelivered) {
      expect(deliveries.length).toBeGreaterThan(0);
    }
  }, 20000);
});
