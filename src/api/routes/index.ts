import { Router } from "express";
import { createHealthRouter } from "./health.routes.js";
import { createJobsRouter } from "./jobs.routes.js";
import { createPipelineActionsRouter } from "./pipeline-actions.routes.js";
import { createPipelinesRouter } from "./pipelines.routes.js";
import { createSubscribersRouter } from "./subscribers.routes.js";
import { createWebhooksRouter } from "./webhooks.routes.js";

export function createApiRouter(startedAt: number) {
  const router = Router();

  router.use(createHealthRouter(startedAt));
  router.use("/api/pipelines", createPipelinesRouter());
  router.use("/api/pipelines/:pipelineId/actions", createPipelineActionsRouter());
  router.use("/api/pipelines/:pipelineId/subscribers", createSubscribersRouter());
  router.use("/api/webhooks", createWebhooksRouter());
  router.use("/webhooks", createWebhooksRouter());
  router.use("/api/jobs", createJobsRouter());

  return router;
}
