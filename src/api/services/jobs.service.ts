import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { webhookJobQueue } from "../../queue/queues.js";
import { AppError } from "../errors/app-error.js";

type ListJobsFilters = {
  pipelineId?: string;
  status?: JobStatus;
  idempotencyKey?: string;
  from?: string;
  to?: string;
  limit?: number;
};

type EnqueueTestJobInput = {
  pipelineId: string;
  payload: Record<string, unknown>;
};

export class JobsService {
  async list(filters: ListJobsFilters) {
    const fromDate = filters.from ? new Date(filters.from) : undefined;
    const toDate = filters.to ? new Date(filters.to) : undefined;

    return prisma.job.findMany({
      where: {
        pipelineId: filters.pipelineId,
        status: filters.status,
        idempotencyKey: filters.idempotencyKey,
        queuedAt: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { queuedAt: "desc" },
      take: filters.limit ?? 50
    });
  }

  async getById(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            sourceToken: true,
            isActive: true
          }
        },
        _count: {
          select: {
            actionRuns: true,
            deliveryAttempts: true
          }
        }
      }
    });

    if (!job) {
      throw new AppError({
        message: "Job not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    return job;
  }

  async getHistory(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        pipelineId: true,
        status: true,
        queuedAt: true,
        startedAt: true,
        finishedAt: true,
        errorSummary: true
      }
    });

    if (!job) {
      throw new AppError({
        message: "Job not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    const [actionRuns, deliveryAttempts] = await Promise.all([
      prisma.jobActionRun.findMany({
        where: { jobId },
        orderBy: [{ actionOrder: "asc" }, { executedAt: "asc" }],
        include: {
          pipelineAction: {
            select: {
              id: true,
              type: true,
              actionOrder: true,
              isActive: true
            }
          }
        }
      }),
      prisma.deliveryAttempt.findMany({
        where: { jobId },
        orderBy: [{ subscriberId: "asc" }, { attemptNumber: "asc" }],
        include: {
          subscriber: {
            select: {
              id: true,
              targetUrl: true,
              isActive: true
            }
          }
        }
      })
    ]);

    return {
      job,
      actionRuns,
      deliveryAttempts
    };
  }

  async enqueueTestJob(input: EnqueueTestJobInput) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: input.pipelineId }, select: { id: true } });
    if (!pipeline) {
      throw new AppError({
        message: "Pipeline not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    const createdJob = await prisma.job.create({
      data: {
        pipelineId: input.pipelineId,
        status: JobStatus.queued,
        inputPayload: input.payload as Prisma.InputJsonValue
      }
    });

    const queueJob = await webhookJobQueue.add(
      "process-webhook-job",
      {
        version: 1,
        jobId: createdJob.id,
        pipelineId: createdJob.pipelineId,
        triggerSource: "manual-test",
        enqueuedAt: new Date().toISOString()
      },
      {
        jobId: createdJob.id
      }
    );

    return {
      jobId: createdJob.id,
      queueJobId: queueJob.id,
      status: createdJob.status
    };
  }
}

export const jobsService = new JobsService();
