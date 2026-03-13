import request from "supertest";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApiApp } from "../../src/api/app";
import { prisma } from "../../src/lib/prisma";
import { resetTestState } from "../helpers/db";

describe("API integration", () => {
  const app = buildApiApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetTestState();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("pipeline CRUD works", async () => {
    const created = await request(app).post("/api/pipelines").send({ name: "Integration Pipeline" }).expect(201);
    const pipelineId = created.body.data.id as string;

    const listed = await request(app).get("/api/pipelines").expect(200);
    expect(listed.body.data.some((item: { id: string }) => item.id === pipelineId)).toBe(true);

    const fetched = await request(app).get(`/api/pipelines/${pipelineId}`).expect(200);
    expect(fetched.body.data.name).toBe("Integration Pipeline");

    await request(app).put(`/api/pipelines/${pipelineId}`).send({ name: "Updated Pipeline", isActive: true }).expect(200);

    const fetchedUpdated = await request(app).get(`/api/pipelines/${pipelineId}`).expect(200);
    expect(fetchedUpdated.body.data.name).toBe("Updated Pipeline");

    await request(app).delete(`/api/pipelines/${pipelineId}`).expect(200);
    await request(app).get(`/api/pipelines/${pipelineId}`).expect(404);
  });

  it("webhook ingestion supports idempotency and does not create duplicate jobs", async () => {
    const created = await request(app).post("/api/pipelines").send({ name: "Webhook Integration" }).expect(201);
    const token = created.body.data.sourceToken as string;
    const pipelineId = created.body.data.id as string;

    const first = await request(app)
      .post(`/webhooks/${token}`)
      .set("x-idempotency-key", "integration-idem-1")
      .send({ event: "integration.webhook" })
      .expect(202);

    const second = await request(app)
      .post(`/webhooks/${token}`)
      .set("x-idempotency-key", "integration-idem-1")
      .send({ event: "integration.webhook" })
      .expect(202);

    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.jobId).toBe(first.body.data.jobId);

    const jobs = await prisma.job.findMany({
      where: {
        pipelineId,
        idempotencyKey: "integration-idem-1"
      }
    });

    expect(jobs).toHaveLength(1);
  });

  it("validates inbound webhook signature when webhook secret is configured", async () => {
    const created = await request(app)
      .post("/api/pipelines")
      .send({ name: "Signed Webhook Pipeline", webhookSecret: "integration-secret" })
      .expect(201);

    const token = created.body.data.sourceToken as string;
    const payload = JSON.stringify({ event: "integration.signed" });
    const validSignature = createHmac("sha256", "integration-secret").update(payload).digest("hex");

    await request(app)
      .post(`/webhooks/${token}`)
      .set("content-type", "application/json")
      .send(payload)
      .expect(401);

    await request(app)
      .post(`/webhooks/${token}`)
      .set("content-type", "application/json")
      .set("x-webhook-signature", "sha256=invalid")
      .send(payload)
      .expect(401);

    await request(app)
      .post(`/webhooks/${token}`)
      .set("content-type", "application/json")
      .set("x-webhook-signature", `sha256=${validSignature}`)
      .send(payload)
      .expect(202);
  });
});
