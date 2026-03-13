import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../errors/app-error.js";

type CreatePipelineInput = {
  name: string;
  isActive?: boolean;
  webhookSecret?: string;
};

type UpdatePipelineInput = {
  name?: string;
  isActive?: boolean;
  webhookSecret?: string | null;
};

export class PipelinesService {
  async list() {
    return prisma.pipeline.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CreatePipelineInput) {
    const sourceToken = await this.generateUniqueSourceToken();

    return prisma.pipeline.create({
      data: {
        name: input.name,
        isActive: input.isActive ?? true,
        sourceToken,
        webhookSecret: input.webhookSecret
      }
    });
  }

  async getById(pipelineId: string) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId }
    });

    if (!pipeline) {
      throw new AppError({
        message: "Pipeline not found",
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    return pipeline;
  }

  async update(pipelineId: string, input: UpdatePipelineInput) {
    await this.getById(pipelineId);

    return prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: input.name,
        isActive: input.isActive,
        webhookSecret: input.webhookSecret
      }
    });
  }

  async remove(pipelineId: string) {
    await this.getById(pipelineId);

    await prisma.pipeline.delete({ where: { id: pipelineId } });

    return { id: pipelineId, deleted: true };
  }

  private async generateUniqueSourceToken() {
    for (let index = 0; index < 5; index += 1) {
      const sourceToken = randomBytes(24).toString("hex");
      const existing = await prisma.pipeline.findUnique({
        where: { sourceToken },
        select: { id: true }
      });

      if (!existing) {
        return sourceToken;
      }
    }

    throw new AppError({
      message: "Failed to generate unique source token",
      statusCode: 500,
      code: "INTERNAL_ERROR"
    });
  }
}

export const pipelinesService = new PipelinesService();
