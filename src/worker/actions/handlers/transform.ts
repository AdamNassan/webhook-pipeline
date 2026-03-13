import type { ActionExecutor, Payload } from "../types.js";

function readStringMap(configValue: unknown): Record<string, string> {
  if (typeof configValue !== "object" || configValue === null || Array.isArray(configValue)) {
    return {};
  }

  const mapped = Object.entries(configValue as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string")
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value as string;
      return acc;
    }, {});

  return mapped;
}

function readRecord(configValue: unknown): Record<string, unknown> {
  if (typeof configValue !== "object" || configValue === null || Array.isArray(configValue)) {
    return {};
  }

  return configValue as Record<string, unknown>;
}

function readStringArray(configValue: unknown): string[] {
  if (!Array.isArray(configValue)) {
    return [];
  }

  return configValue.filter((item): item is string => typeof item === "string");
}

export const transformAction: ActionExecutor = async ({ payload, config }) => {
  const rename = readStringMap(config.rename);
  const defaults = readRecord(config.defaults);
  const pick = readStringArray(config.pick);

  const nextPayload: Payload = { ...payload };

  for (const [fromKey, toKey] of Object.entries(rename)) {
    if (Object.prototype.hasOwnProperty.call(nextPayload, fromKey)) {
      nextPayload[toKey] = nextPayload[fromKey];
      delete nextPayload[fromKey];
    }
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in nextPayload)) {
      nextPayload[key] = value;
    }
  }

  if (pick.length > 0) {
    const pickedPayload: Payload = {};
    for (const key of pick) {
      if (Object.prototype.hasOwnProperty.call(nextPayload, key)) {
        pickedPayload[key] = nextPayload[key];
      }
    }

    return {
      status: "succeeded",
      payload: pickedPayload
    };
  }

  return {
    status: "succeeded",
    payload: nextPayload
  };
};
