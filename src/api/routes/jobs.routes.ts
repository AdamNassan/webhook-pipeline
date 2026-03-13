import { Router } from "express";
import { getValidated } from "../middleware/validated.js";
import { jobsService } from "../services/jobs.service.js";
import { validateRequest, z } from "../middleware/validate.js";

const listJobsQuerySchema = z.object({
  pipelineId: z.string().min(1).optional(),
  status: z.enum(["queued", "processing", "succeeded", "failed", "dropped"]).optional(),
  idempotencyKey: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const jobParamsSchema = z.object({
  jobId: z.string().min(5)
});

const enqueueTestJobBodySchema = z.object({
  pipelineId: z.string().min(5),
  payload: z.record(z.string(), z.unknown()).default({})
});

export function createJobsRouter() {
  const router = Router();

  router.get("/", validateRequest({ query: listJobsQuerySchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const jobs = await jobsService.list(validated.query as z.infer<typeof listJobsQuerySchema>);
      res.status(200).json({ data: jobs });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:jobId", validateRequest({ params: jobParamsSchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof jobParamsSchema>;
      const job = await jobsService.getById(params.jobId);
      res.status(200).json({ data: job });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:jobId/history", validateRequest({ params: jobParamsSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof jobParamsSchema>;
      const history = await jobsService.getHistory(params.jobId);
      res.status(200).json({ data: history });
    } catch (error) {
      next(error);
    }
  });

  router.post("/enqueue-test", validateRequest({ body: enqueueTestJobBodySchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const result = await jobsService.enqueueTestJob(validated.body as z.infer<typeof enqueueTestJobBodySchema>);
      res.status(202).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
