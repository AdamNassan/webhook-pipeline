import { createHmac, timingSafeEqual } from "node:crypto";
import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { webhookJobQueue } from "../../queue/queues.js";
import { AppError } from "../errors/app-error.js";

type IngestWebhookInput = {
  sourceToken: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  inboundSignature?: string;
  rawBody?: string;
};

export class WebhooksService {
  async ingest(input: IngestWebhookInput) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { sourceToken: input.sourceToken },
      select: { id: true, isActive: true, webhookSecret: true }
    });

    if (!pipeline) {
      throw new AppError({
        message: "Pipeline source token not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    if (!pipeline.isActive) {
      throw new AppError({
        message: "Pipeline is inactive and cannot accept webhooks",
        statusCode: 409,
        code: "VALIDATION_ERROR"
      });
    }

    if (pipeline.webhookSecret) {
      if (!input.inboundSignature) {
        throw new AppError({
          message: "Missing webhook signature",
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      const isValid = this.verifyInboundSignature({
        secret: pipeline.webhookSecret,
        payload: input.rawBody ?? JSON.stringify(input.payload),
        provided: input.inboundSignature
      });

      if (!isValid) {
        throw new AppError({
          message: "Invalid webhook signature",
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }
    }

    if (input.idempotencyKey) {
      const existing = await prisma.job.findFirst({
        where: {
          pipelineId: pipeline.id,
          idempotencyKey: input.idempotencyKey
        }
      });

      if (existing) {
        return {
          accepted: true,
          duplicate: true,
          pipelineId: pipeline.id,
          jobId: existing.id,
          status: existing.status,
          idempotencyKey: existing.idempotencyKey
        };
      }
    }

    const createdJob = await prisma.job.create({
      data: {
        pipelineId: pipeline.id,
        status: JobStatus.queued,
        idempotencyKey: input.idempotencyKey,
        inputPayload: input.payload as Prisma.InputJsonValue
      }
    });

    try {
      await webhookJobQueue.add(
        "process-webhook-job",
        {
          version: 1,
          jobId: createdJob.id,
          pipelineId: createdJob.pipelineId,
          triggerSource: "webhook",
          enqueuedAt: new Date().toISOString()
        },
        {
          jobId: createdJob.id
        }
      );
    } catch (error) {
      await prisma.job.update({
        where: { id: createdJob.id },
        data: {
          status: JobStatus.failed,
          errorSummary: error instanceof Error ? error.message : "Queue publish failed",
          finishedAt: new Date()
        }
      });
      throw error;
    }

    return {
      accepted: true,
      duplicate: false,
      pipelineId: pipeline.id,
      jobId: createdJob.id,
      status: createdJob.status,
      idempotencyKey: createdJob.idempotencyKey
    };
  }

  private verifyInboundSignature(input: { secret: string; payload: string; provided: string }) {
    const normalized = input.provided.startsWith("sha256=") ? input.provided.slice(7) : input.provided;
    const expectedHex = createHmac("sha256", input.secret).update(input.payload).digest("hex");

    if (normalized.length !== expectedHex.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(normalized, "utf8"), Buffer.from(expectedHex, "utf8"));
  }
}

export const webhooksService = new WebhooksService();
