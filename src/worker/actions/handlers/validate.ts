import type { ActionExecutor } from "../types.js";

export const validateAction: ActionExecutor = async ({ payload, config }) => {
  const requiredFields = Array.isArray(config.requiredFields)
    ? config.requiredFields.filter((field): field is string => typeof field === "string")
    : [];
  const failOnError = typeof config.failOnError === "boolean" ? config.failOnError : true;

  const missingFields = requiredFields.filter((field) => payload[field] === undefined);

  if (missingFields.length === 0) {
    return {
      status: "succeeded",
      payload
    };
  }

  const message = `Validation failed. Missing required fields: ${missingFields.join(", ")}`;

  if (failOnError) {
    throw new Error(message);
  }

  return {
    status: "skipped",
    payload,
    message
  };
};
