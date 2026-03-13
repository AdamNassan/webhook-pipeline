import { prisma } from "../../lib/prisma.js";
import { AppError } from "../errors/app-error.js";

type CreateSubscriberInput = {
  targetUrl: string;
  isActive?: boolean;
  secret?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

type UpdateSubscriberInput = {
  targetUrl?: string;
  isActive?: boolean;
  secret?: string | null;
  maxRetries?: number;
  timeoutMs?: number;
};

export class SubscribersService {
  async listByPipeline(pipelineId: string) {
    await this.ensurePipelineExists(pipelineId);

    return prisma.subscriber.findMany({
      where: { pipelineId },
      orderBy: { createdAt: "asc" }
    });
  }

  async createForPipeline(pipelineId: string, input: CreateSubscriberInput) {
    await this.ensurePipelineExists(pipelineId);

    return prisma.subscriber.create({
      data: {
        pipelineId,
        targetUrl: input.targetUrl,
        isActive: input.isActive ?? true,
        secret: input.secret,
        maxRetries: input.maxRetries ?? 5,
        timeoutMs: input.timeoutMs ?? 10000
      }
    });
  }

  async getById(pipelineId: string, subscriberId: string) {
    const subscriber = await prisma.subscriber.findFirst({
      where: {
        id: subscriberId,
        pipelineId
      }
    });

    if (!subscriber) {
      throw new AppError({
        message: "Subscriber not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    return subscriber;
  }

  async update(pipelineId: string, subscriberId: string, input: UpdateSubscriberInput) {
    await this.getById(pipelineId, subscriberId);

    return prisma.subscriber.update({
      where: { id: subscriberId },
      data: {
        targetUrl: input.targetUrl,
        isActive: input.isActive,
        secret: input.secret,
        maxRetries: input.maxRetries,
        timeoutMs: input.timeoutMs
      }
    });
  }

  async remove(pipelineId: string, subscriberId: string) {
    await this.getById(pipelineId, subscriberId);

    await prisma.subscriber.delete({ where: { id: subscriberId } });
    return { id: subscriberId, deleted: true };
  }

  private async ensurePipelineExists(pipelineId: string) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { id: true } });
    if (!pipeline) {
      throw new AppError({
        message: "Pipeline not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }
  }
}

export const subscribersService = new SubscribersService();
