import type { ActionExecutor } from "../types.js";

export const filterAction: ActionExecutor = async ({ payload, config }) => {
  const field = typeof config.field === "string" ? config.field : "";
  if (!field) {
    throw new Error("Filter action requires a 'field' string in config");
  }

  const currentValue = payload[field];
  const hasEquals = Object.prototype.hasOwnProperty.call(config, "equals");
  const hasNotEquals = Object.prototype.hasOwnProperty.call(config, "notEquals");
  const inValues = Array.isArray(config.in) ? config.in : undefined;

  let matches = true;

  if (hasEquals) {
    matches = matches && currentValue === config.equals;
  }

  if (hasNotEquals) {
    matches = matches && currentValue !== config.notEquals;
  }

  if (inValues) {
    matches = matches && inValues.some((item) => item === currentValue);
  }

  if (matches) {
    return {
      status: "succeeded",
      payload
    };
  }

  const onFail = config.onFail === "continue" || config.onFail === "fail" || config.onFail === "drop" ? config.onFail : "drop";

  if (onFail === "fail") {
    throw new Error(`Filter condition did not match for field '${field}'`);
  }

  if (onFail === "continue") {
    return {
      status: "skipped",
      payload,
      message: `Filter condition did not match for field '${field}', continuing`
    };
  }

  return {
    status: "succeeded",
    payload,
    dropped: true,
    message: `Filter condition did not match for field '${field}', dropping job`
  };
};
