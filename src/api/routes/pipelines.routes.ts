import { Router } from "express";
import { getValidated } from "../middleware/validated.js";
import { pipelinesService } from "../services/pipelines.service.js";
import { validateRequest, z } from "../middleware/validate.js";

const createPipelineBodySchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
  webhookSecret: z.string().min(8).optional()
});

const updatePipelineBodySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  webhookSecret: z.string().min(8).nullable().optional()
});

const pipelineIdParamSchema = z.object({
  pipelineId: z.string().min(5)
});

export function createPipelinesRouter() {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const pipelines = await pipelinesService.list();
      res.status(200).json({ data: pipelines });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateRequest({ body: createPipelineBodySchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const created = await pipelinesService.create(validated.body as z.infer<typeof createPipelineBodySchema>);
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:pipelineId", validateRequest({ params: pipelineIdParamSchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
      const pipeline = await pipelinesService.getById(params.pipelineId);
      res.status(200).json({ data: pipeline });
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:pipelineId",
    validateRequest({ params: pipelineIdParamSchema, body: updatePipelineBodySchema }),
    async (req, res, next) => {
      try {
        const validated = getValidated(res);
        const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
        const updated = await pipelinesService.update(params.pipelineId, validated.body as z.infer<typeof updatePipelineBodySchema>);
        res.status(200).json({ data: updated });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete("/:pipelineId", validateRequest({ params: pipelineIdParamSchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
      const deleted = await pipelinesService.remove(params.pipelineId);
      res.status(200).json({ data: deleted });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
