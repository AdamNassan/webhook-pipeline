import { prisma } from "../../src/lib/prisma";
import { webhookJobQueue } from "../../src/queue/queues";

export async function resetDatabase() {
  await prisma.deliveryAttempt.deleteMany();
  await prisma.jobActionRun.deleteMany();
  await prisma.job.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.pipelineAction.deleteMany();
  await prisma.pipeline.deleteMany();
}

export async function resetQueue() {
  await webhookJobQueue.obliterate({ force: true });
}

export async function resetTestState() {
  await resetQueue();
  await resetDatabase();
}
