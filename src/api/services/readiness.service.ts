import IORedis from "ioredis";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { webhookJobQueue } from "../../queue/queues.js";

export type DependencyCheck = {
  name: string;
  ok: boolean;
  message?: string;
};

export async function checkReadiness(): Promise<{ ok: boolean; checks: DependencyCheck[] }> {
  const checks: DependencyCheck[] = [];

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    checks.push({ name: "postgres", ok: true });
  } catch (error) {
    checks.push({ name: "postgres", ok: false, message: error instanceof Error ? error.message : "Unknown error" });
  }

  let redis: IORedis | null = null;
  try {
    redis = new IORedis(env.REDIS_URL);
    await redis.ping();
    checks.push({ name: "redis", ok: true });
  } catch (error) {
    checks.push({ name: "redis", ok: false, message: error instanceof Error ? error.message : "Unknown error" });
  } finally {
    if (redis) {
      await redis.quit();
    }
  }

  try {
    const queueCounts = await webhookJobQueue.getJobCounts("waiting", "active", "delayed", "failed");
    checks.push({
      name: "queue",
      ok: true,
      message: JSON.stringify(queueCounts)
    });
  } catch (error) {
    checks.push({ name: "queue", ok: false, message: error instanceof Error ? error.message : "Unknown error" });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}
