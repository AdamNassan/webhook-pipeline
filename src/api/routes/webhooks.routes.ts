import { Router } from "express";
import { getValidated } from "../middleware/validated.js";
import { webhooksService } from "../services/webhooks.service.js";
import { validateRequest, z } from "../middleware/validate.js";

const webhookParamsSchema = z.object({
  sourceToken: z.string().min(10)
});

const webhookBodySchema = z.record(z.string(), z.unknown());

export function createWebhooksRouter() {
  const router = Router();

  router.post("/:sourceToken", validateRequest({ params: webhookParamsSchema, body: webhookBodySchema }), async (req, res, next) => {
    try {
      const validated = getValidated(res);
      const params = validated.params as z.infer<typeof webhookParamsSchema>;
      const payload = validated.body as z.infer<typeof webhookBodySchema>;
      const idempotencyFromHeader = typeof req.headers["x-idempotency-key"] === "string" ? req.headers["x-idempotency-key"] : undefined;
      const idempotencyFromBody = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined;
      const inboundSignature = typeof req.headers["x-webhook-signature"] === "string" ? req.headers["x-webhook-signature"] : undefined;
      const rawBody = (req as { rawBody?: string }).rawBody;
      const result = await webhooksService.ingest({
        sourceToken: params.sourceToken,
        payload,
        idempotencyKey: idempotencyFromHeader ?? idempotencyFromBody,
        inboundSignature,
        rawBody
      });
      res.status(202).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
