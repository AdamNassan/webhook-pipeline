-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'succeeded', 'failed', 'dropped');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'retrying', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('transform', 'validate', 'filter');

-- CreateEnum
CREATE TYPE "ActionRunStatus" AS ENUM ('succeeded', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_actions" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "actionOrder" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB,
    "errorSummary" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_action_runs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "pipelineActionId" TEXT NOT NULL,
    "status" "ActionRunStatus" NOT NULL,
    "actionOrder" INTEGER NOT NULL,
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_action_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_sourceToken_key" ON "pipelines"("sourceToken");

-- CreateIndex
CREATE INDEX "pipeline_actions_pipelineId_idx" ON "pipeline_actions"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_actions_pipelineId_actionOrder_key" ON "pipeline_actions"("pipelineId", "actionOrder");

-- CreateIndex
CREATE INDEX "subscribers_pipelineId_idx" ON "subscribers"("pipelineId");

-- CreateIndex
CREATE INDEX "jobs_pipelineId_status_idx" ON "jobs"("pipelineId", "status");

-- CreateIndex
CREATE INDEX "jobs_queuedAt_idx" ON "jobs"("queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_pipelineId_idempotencyKey_key" ON "jobs"("pipelineId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "job_action_runs_jobId_actionOrder_idx" ON "job_action_runs"("jobId", "actionOrder");

-- CreateIndex
CREATE INDEX "job_action_runs_pipelineActionId_idx" ON "job_action_runs"("pipelineActionId");

-- CreateIndex
CREATE INDEX "delivery_attempts_jobId_idx" ON "delivery_attempts"("jobId");

-- CreateIndex
CREATE INDEX "delivery_attempts_subscriberId_status_idx" ON "delivery_attempts"("subscriberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_jobId_subscriberId_attemptNumber_key" ON "delivery_attempts"("jobId", "subscriberId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "pipeline_actions" ADD CONSTRAINT "pipeline_actions_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_action_runs" ADD CONSTRAINT "job_action_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_action_runs" ADD CONSTRAINT "job_action_runs_pipelineActionId_fkey" FOREIGN KEY ("pipelineActionId") REFERENCES "pipeline_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
