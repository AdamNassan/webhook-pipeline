import type { ActionType } from "@prisma/client";
import { filterAction } from "./handlers/filter.js";
import { transformAction } from "./handlers/transform.js";
import { validateAction } from "./handlers/validate.js";
import type { ActionExecutor } from "./types.js";

const registry: Record<ActionType, ActionExecutor> = {
  transform: transformAction,
  validate: validateAction,
  filter: filterAction
};

export function getActionExecutor(type: ActionType): ActionExecutor {
  const executor = registry[type];
  if (!executor) {
    throw new Error(`Unsupported action type '${type}'`);
  }

  return executor;
}
