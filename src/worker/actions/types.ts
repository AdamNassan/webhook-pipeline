export type Payload = Record<string, unknown>;

export type ActionContext = {
  payload: Payload;
  config: Record<string, unknown>;
};

export type ActionExecutionResult = {
  status: "succeeded" | "skipped";
  payload: Payload;
  dropped?: boolean;
  message?: string;
};

export type ActionExecutor = (context: ActionContext) => Promise<ActionExecutionResult>;

export function toPayload(value: unknown): Payload {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Payload;
  }

  return { value };
}
