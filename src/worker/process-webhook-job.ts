import { ActionRunStatus, JobStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { WebhookJobPayload } from "../queue/contracts.js";
import { getActionExecutor } from "./actions/registry.js";
import { toPayload } from "./actions/types.js";
import { deliverToSubscribers } from "./delivery.js";

export async function processWebhookJob(queueJobId: string | undefined, payload: WebhookJobPayload) {
  const record = await prisma.job.findUnique({ where: { id: payload.jobId } });
  if (!record) {
    throw new Error(`Job record not found for id ${payload.jobId}`);
  }

  await prisma.job.update({
    where: { id: record.id },
    data: {
      status: JobStatus.processing,
      startedAt: new Date(),
      errorSummary: null
    }
  });

  try {
    const actions = await prisma.pipelineAction.findMany({
      where: {
        pipelineId: record.pipelineId,
        isActive: true
      },
      orderBy: {
        actionOrder: "asc"
      }
    });

    let currentPayload = toPayload(record.inputPayload);

    for (const action of actions) {
      const started = Date.now();
      const actionInput = currentPayload;

      try {
        const executor = getActionExecutor(action.type);
        const result = await executor({
          payload: currentPayload,
          config: toPayload(action.config)
        });

        currentPayload = result.payload;

        await prisma.jobActionRun.create({
          data: {
            jobId: record.id,
            pipelineActionId: action.id,
            status: result.status === "skipped" ? ActionRunStatus.skipped : ActionRunStatus.succeeded,
            actionOrder: action.actionOrder,
            inputPayload: actionInput as Prisma.InputJsonValue,
            outputPayload: result.payload as Prisma.InputJsonValue,
            errorMessage: result.message,
            durationMs: Date.now() - started
          }
        });

        if (result.dropped) {
          const droppedPayload = {
            ...currentPayload,
            processing: {
              source: payload.triggerSource,
              processedAt: new Date().toISOString(),
              queueJobId,
              dropped: true,
              droppedByActionOrder: action.actionOrder
            }
          };

          await prisma.job.update({
            where: { id: record.id },
            data: {
              status: JobStatus.dropped,
              outputPayload: droppedPayload,
              finishedAt: new Date()
            }
          });

          return { accepted: true, persistedJobId: record.id, dropped: true };
        }
      } catch (error) {
        await prisma.jobActionRun.create({
          data: {
            jobId: record.id,
            pipelineActionId: action.id,
            status: ActionRunStatus.failed,
            actionOrder: action.actionOrder,
            inputPayload: actionInput as Prisma.InputJsonValue,
            errorMessage: error instanceof Error ? error.message : "Unknown action execution error",
            durationMs: Date.now() - started
          }
        });

        throw error;
      }
    }

    const outputPayload = {
      ...currentPayload,
      processing: {
        source: payload.triggerSource,
        processedAt: new Date().toISOString(),
        queueJobId
      }
    };

    const deliverySummary = await deliverToSubscribers({
      prisma,
      jobId: record.id,
      pipelineId: record.pipelineId,
      payload: outputPayload
    });

    await prisma.job.update({
      where: { id: record.id },
      data: {
        status: JobStatus.succeeded,
        outputPayload: {
          ...outputPayload,
          delivery: deliverySummary
        },
        finishedAt: new Date()
      }
    });

    return { accepted: true, persistedJobId: record.id };
  } catch (error) {
    await prisma.job.update({
      where: { id: record.id },
      data: {
        status: JobStatus.failed,
        errorSummary: error instanceof Error ? error.message : "Unknown worker error",
        finishedAt: new Date()
      }
    });
    throw error;
  }
}
