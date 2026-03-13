import { Router } from "express";
import { getValidated } from "../middleware/validated.js";
import { pipelineActionsService } from "../services/pipeline-actions.service.js";
import { validateRequest, z } from "../middleware/validate.js";

const pipelineIdParamSchema = z.object({
  pipelineId: z.string().min(5)
});

const actionIdParamSchema = z.object({
  pipelineId: z.string().min(5),
  actionId: z.string().min(5)
});

const actionTypeSchema = z.enum(["transform", "validate", "filter"]);

const createActionBodySchema = z.object({
  type: actionTypeSchema,
  actionOrder: z.number().int().min(1),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional()
});

const updateActionBodySchema = z.object({
  type: actionTypeSchema.optional(),
  actionOrder: z.number().int().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional()
});

export function createPipelineActionsRouter() {
  const router = Router({ mergeParams: true });

  router.get("/", validateRequest({ params: pipelineIdParamSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
      const actions = await pipelineActionsService.listByPipeline(params.pipelineId);
      res.status(200).json({ data: actions });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateRequest({ params: pipelineIdParamSchema, body: createActionBodySchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
      const created = await pipelineActionsService.createForPipeline(params.pipelineId, validated.body as z.infer<typeof createActionBodySchema>);
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:actionId", validateRequest({ params: actionIdParamSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof actionIdParamSchema>;
      const action = await pipelineActionsService.getById(params.pipelineId, params.actionId);
      res.status(200).json({ data: action });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:actionId", validateRequest({ params: actionIdParamSchema, body: updateActionBodySchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof actionIdParamSchema>;
      const updated = await pipelineActionsService.update(params.pipelineId, params.actionId, validated.body as z.infer<typeof updateActionBodySchema>);
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:actionId", validateRequest({ params: actionIdParamSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof actionIdParamSchema>;
      const deleted = await pipelineActionsService.remove(params.pipelineId, params.actionId);
      res.status(200).json({ data: deleted });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
