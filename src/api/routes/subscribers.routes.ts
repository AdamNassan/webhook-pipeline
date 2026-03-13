import { Router } from "express";
import { getValidated } from "../middleware/validated.js";
import { subscribersService } from "../services/subscribers.service.js";
import { validateRequest, z } from "../middleware/validate.js";

const pipelineIdParamSchema = z.object({
  pipelineId: z.string().min(5)
});

const createSubscriberBodySchema = z.object({
  targetUrl: z.string().url(),
  isActive: z.boolean().optional(),
  secret: z.string().min(1).optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional()
});

const subscriberIdParamSchema = z.object({
  pipelineId: z.string().min(5),
  subscriberId: z.string().min(5)
});

const updateSubscriberBodySchema = z.object({
  targetUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  secret: z.string().min(1).nullable().optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional()
});

export function createSubscribersRouter() {
  const router = Router({ mergeParams: true });

  router.get("/", validateRequest({ params: pipelineIdParamSchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
      const subscribers = await subscribersService.listByPipeline(params.pipelineId);
      res.status(200).json({ data: subscribers });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",
    validateRequest({ params: pipelineIdParamSchema, body: createSubscriberBodySchema }),
    async (req, res, next) => {
      try {
        const validated = getValidated(res);
        const params = validated.params as z.infer<typeof pipelineIdParamSchema>;
        const created = await subscribersService.createForPipeline(params.pipelineId, validated.body as z.infer<typeof createSubscriberBodySchema>);
        res.status(201).json({ data: created });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:subscriberId", validateRequest({ params: subscriberIdParamSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof subscriberIdParamSchema>;
      const subscriber = await subscribersService.getById(params.pipelineId, params.subscriberId);
      res.status(200).json({ data: subscriber });
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:subscriberId",
    validateRequest({ params: subscriberIdParamSchema, body: updateSubscriberBodySchema }),
    async (_req, res, next) => {
      try {
        const validated = getValidated(res);
        const params = validated.params as z.infer<typeof subscriberIdParamSchema>;
        const updated = await subscribersService.update(params.pipelineId, params.subscriberId, validated.body as z.infer<typeof updateSubscriberBodySchema>);
        res.status(200).json({ data: updated });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete("/:subscriberId", validateRequest({ params: subscriberIdParamSchema }), async (_req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof subscriberIdParamSchema>;
      const deleted = await subscribersService.remove(params.pipelineId, params.subscriberId);
      res.status(200).json({ data: deleted });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
