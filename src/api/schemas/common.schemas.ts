import { z } from "../middleware/validate.js";

export const cuidParamSchema = z.object({
  id: z.string().min(5)
});

export const sourceTokenParamSchema = z.object({
  sourceToken: z.string().min(10)
});
