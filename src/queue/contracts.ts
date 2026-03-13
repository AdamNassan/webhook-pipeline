export type JobTriggerSource = "manual-test" | "webhook";

export type WebhookJobPayload = {
  version: 1;
  jobId: string;
  pipelineId: string;
  triggerSource: JobTriggerSource;
  enqueuedAt: string;
};
