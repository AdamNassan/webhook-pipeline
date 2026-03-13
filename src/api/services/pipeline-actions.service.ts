import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../errors/app-error.js";

type CreateActionInput = {
  type: "transform" | "validate" | "filter";
  actionOrder: number;
  config: unknown;
  isActive?: boolean;
};

type UpdateActionInput = {
  type?: "transform" | "validate" | "filter";
  actionOrder?: number;
  config?: unknown;
  isActive?: boolean;
};

export class PipelineActionsService {
  async listByPipeline(pipelineId: string) {
    await this.ensurePipelineExists(pipelineId);

    return prisma.pipelineAction.findMany({
      where: { pipelineId },
      orderBy: { actionOrder: "asc" }
    });
  }

  async createForPipeline(pipelineId: string, input: CreateActionInput) {
    await this.ensurePipelineExists(pipelineId);

    try {
      return await prisma.pipelineAction.create({
        data: {
          pipelineId,
          type: input.type,
          actionOrder: input.actionOrder,
          config: input.config as Prisma.InputJsonValue,
          isActive: input.isActive ?? true
        }
      });
    } catch (error) {
      this.rethrowPrismaError(error, "action");
    }
  }

  async getById(pipelineId: string, actionId: string) {
    const action = await prisma.pipelineAction.findFirst({
      where: {
        id: actionId,
        pipelineId
      }
    });

    if (!action) {
      throw new AppError({
        message: "Action not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    return action;
  }

  async update(pipelineId: string, actionId: string, input: UpdateActionInput) {
    await this.getById(pipelineId, actionId);

    try {
      return await prisma.pipelineAction.update({
        where: { id: actionId },
        data: {
          type: input.type,
          actionOrder: input.actionOrder,
          config: input.config as Prisma.InputJsonValue,
          isActive: input.isActive
        }
      });
    } catch (error) {
      this.rethrowPrismaError(error, "action");
    }
  }

  async remove(pipelineId: string, actionId: string) {
    await this.getById(pipelineId, actionId);

    await prisma.pipelineAction.delete({ where: { id: actionId } });

    return { id: actionId, deleted: true };
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

  private rethrowPrismaError(error: unknown, subject: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError({
        message: `A ${subject} with this unique value already exists`,
        statusCode: 409,
        code: "VALIDATION_ERROR",
        details: error.meta
      });
    }

    throw error;
  }
}

export const pipelineActionsService = new PipelineActionsService();
