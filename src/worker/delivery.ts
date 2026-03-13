import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { DeliveryStatus, type PrismaClient, type Subscriber } from "@prisma/client";

type DeliveryResult = {
  subscriberId: string;
  delivered: boolean;
  attempts: number;
  finalStatus: DeliveryStatus;
  lastError?: string;
};

type DeliverySummary = {
  totalSubscribers: number;
  deliveredSubscribers: number;
  failedSubscribers: number;
  results: DeliveryResult[];
};

function buildSignature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function isTransientFailure(statusCode?: number): boolean {
  if (!statusCode) {
    return true;
  }

  if (statusCode === 429) {
    return true;
  }

  return statusCode >= 500;
}

export function backoffMs(attempt: number): number {
  const base = 1000;
  const delay = base * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, 30000);
}

async function postToSubscriber(subscriber: Subscriber, requestBody: string): Promise<{ ok: boolean; statusCode?: number; responseBody?: string; errorMessage?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, subscriber.timeoutMs);

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (subscriber.secret) {
      headers["x-webhook-signature"] = buildSignature(subscriber.secret, requestBody);
    }

    const response = await fetch(subscriber.targetUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal
    });

    const responseBody = await response.text();

    return {
      ok: response.ok,
      statusCode: response.status,
      responseBody
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : "Unknown delivery error"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverToSubscribers(params: {
  prisma: PrismaClient;
  jobId: string;
  pipelineId: string;
  payload: Record<string, unknown>;
}): Promise<DeliverySummary> {
  const subscribers = await params.prisma.subscriber.findMany({
    where: {
      pipelineId: params.pipelineId,
      isActive: true
    },
    orderBy: { createdAt: "asc" }
  });

  const results: DeliveryResult[] = [];

  for (const subscriber of subscribers) {
    const requestBody = JSON.stringify({
      jobId: params.jobId,
      pipelineId: params.pipelineId,
      payload: params.payload,
      deliveredAt: new Date().toISOString()
    });

    const maxAttempts = Math.max(1, subscriber.maxRetries + 1);
    let finalStatus: DeliveryStatus = DeliveryStatus.failed;
    let delivered = false;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await postToSubscriber(subscriber, requestBody);
      const transient = !result.ok && isTransientFailure(result.statusCode);
      const hasRemaining = attempt < maxAttempts;
      const nextAttemptAt = transient && hasRemaining ? new Date(Date.now() + backoffMs(attempt)) : null;

      if (result.ok) {
        finalStatus = DeliveryStatus.delivered;
        delivered = true;
      } else if (transient && hasRemaining) {
        finalStatus = DeliveryStatus.retrying;
      } else {
        finalStatus = DeliveryStatus.failed;
        lastError = result.errorMessage ?? `HTTP ${result.statusCode ?? 0}`;
      }

      await params.prisma.deliveryAttempt.create({
        data: {
          jobId: params.jobId,
          subscriberId: subscriber.id,
          attemptNumber: attempt,
          status: finalStatus,
          responseCode: result.statusCode,
          responseBody: result.responseBody,
          errorMessage: result.errorMessage,
          nextAttemptAt,
          attemptedAt: new Date(),
          deliveredAt: delivered ? new Date() : null
        }
      });

      if (delivered) {
        break;
      }

      if (finalStatus === DeliveryStatus.failed) {
        break;
      }

      await sleep(backoffMs(attempt));
    }

    results.push({
      subscriberId: subscriber.id,
      delivered,
      attempts: await params.prisma.deliveryAttempt.count({ where: { jobId: params.jobId, subscriberId: subscriber.id } }),
      finalStatus,
      lastError
    });
  }

  const deliveredSubscribers = results.filter((entry) => entry.delivered).length;

  return {
    totalSubscribers: subscribers.length,
    deliveredSubscribers,
    failedSubscribers: subscribers.length - deliveredSubscribers,
    results
  };
}
