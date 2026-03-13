# Webhook-Driven Task Processing Pipeline

A production-style TypeScript service that receives inbound webhooks on unique pipeline URLs, queues them for background processing, executes ordered actions, and delivers results to subscribers with retry tracking.

## Stack

- Node.js 20
- TypeScript
- Express
- Prisma
- PostgreSQL
- BullMQ
- Redis
- Docker Compose
- Vitest
- GitHub Actions

## Architecture

- API process
  - Manages pipelines, actions, subscribers, jobs, and webhook ingestion.
  - Persists jobs before queueing.
  - Returns 202 for async ingestion.
- Worker process
  - Consumes queued jobs.
  - Executes ordered action pipeline: transform, validate, filter.
  - Persists per-action history.
  - Fans out results to subscribers and records all delivery attempts.
- PostgreSQL
  - Source of truth for all domain entities and history.
- Redis
  - Queue backend for BullMQ.

High-level flow:

1. Create pipeline with actions and subscribers.
2. POST webhook to /webhooks/:sourceToken.
3. API persists job as queued and publishes queue message.
4. Worker processes action chain and updates job state.
5. Worker delivers result to subscribers with retry policy.
6. API exposes list/detail/history inspection.

## Project Structure

- src/api: API app, routes, middleware, services
- src/worker: Worker entrypoint, action handlers, delivery engine
- src/queue: Queue connection and contracts
- prisma: Data model and migrations
- tests: Unit, integration, and e2e tests

## Data Model Rationale

Core tables:

- pipelines
  - Defines ingestion identity via unique sourceToken and activation state.
- pipeline_actions
  - Ordered actions per pipeline using unique (pipelineId, actionOrder).
- subscribers
  - Target URLs plus delivery settings (maxRetries, timeoutMs, optional secret).
- jobs
  - Tracks lifecycle (queued, processing, succeeded, failed, dropped), payloads, idempotency.
- job_action_runs
  - Immutable per-action execution records with input/output, duration, and status.
- delivery_attempts
  - Every outbound attempt, status transitions, timing, and response metadata.

This schema supports inspection from ingestion to action execution to subscriber delivery.

## Processing Actions

The worker executes active actions in ascending actionOrder.

- transform
  - Supports key rename, defaults, and optional pick list.
- validate
  - Checks required fields with fail-or-continue behavior.
- filter
  - Rule-based pass/fail with onFail strategies:
    - drop
    - fail
    - continue

## Retry and Failure Behavior

Subscriber delivery behavior:

- Success: status delivered and deliveredAt timestamp set.
- Transient failure (network, timeout, 429, 5xx): retry with exponential backoff.
- Permanent failure (other 4xx): no retry, terminal failed status.
- Every attempt is persisted in delivery_attempts.

Exponential backoff currently uses 1s, 2s, 4s... with an upper cap.

## Idempotency Behavior

Webhook ingestion accepts idempotency key from:

- Header: x-idempotency-key
- Body fallback: idempotencyKey

If the same pipeline receives the same idempotency key again, API returns 202 with duplicate=true and the original jobId instead of creating a duplicate job.

## Inbound Signature Verification (Optional Enhancement)

Pipelines can optionally enforce signed inbound webhooks by setting `webhookSecret` on the pipeline.

- Header: `x-webhook-signature`
- Supported format: `<hex>` or `sha256=<hex>`
- Signature algorithm: HMAC-SHA256 over the raw request body bytes

Behavior:

- If `webhookSecret` is set and signature header is missing, API returns 401.
- If signature is present but invalid, API returns 401.
- If valid, ingestion continues normally and returns 202.

## Local Setup

Prerequisites:

- Docker
- Docker Compose
- Node.js 20+ and npm

1. Install dependencies

   npm ci

2. Configure environment

   Copy .env.example to .env and adjust values if needed.

3. Start infrastructure

   docker compose up -d postgres redis

4. Run migration and generate client

   npm run prisma:generate
   npm run prisma:migrate:deploy

5. Start API and worker (local host mode)

   npm run dev:api
   npm run dev:worker

Alternative: run full stack in Docker

- docker compose up --build

## API Examples

### Create pipeline

POST /api/pipelines

{
  "name": "Orders Pipeline",
  "isActive": true,
  "webhookSecret": "optional-inbound-secret"
}

### Add action

POST /api/pipelines/:pipelineId/actions

{
  "type": "transform",
  "actionOrder": 1,
  "config": {
    "rename": { "oldField": "newField" },
    "defaults": { "country": "US" }
  }
}

### Add subscriber

POST /api/pipelines/:pipelineId/subscribers

{
  "targetUrl": "https://example.com/webhook",
  "maxRetries": 2,
  "timeoutMs": 1000,
  "secret": "optional-shared-secret"
}

### Ingest webhook

POST /webhooks/:sourceToken
Header: x-idempotency-key: abc-123
Header: x-webhook-signature: sha256=<hmac-hex>

{
  "event": "order.created",
  "oldField": "value"
}

### Inspect jobs

- GET /api/jobs?pipelineId=...&status=succeeded&limit=20
- GET /api/jobs/:jobId
- GET /api/jobs/:jobId/history

## Quality Commands

- npm run lint
- npm run typecheck
- npm test
- docker build -t webhook-driven-task-pipeline:local .

## Demo Rehearsal Flow

1. Create pipeline, one transform action, and one subscriber.
2. Send webhook with `x-idempotency-key` and optional valid `x-webhook-signature` if pipeline uses `webhookSecret`.
3. Poll `GET /api/jobs/:jobId/history` until delivery attempts are recorded.
4. Re-send same idempotency key and verify `duplicate=true` with same jobId.

## CI

GitHub Actions workflow is defined in .github/workflows/ci.yml and runs:

- install
- prisma generate
- prisma migrate deploy
- lint
- typecheck
- test
- docker build

## Design Decisions

- Persist-before-queue on webhook ingestion for reliable auditability.
- Asynchronous processing only; no synchronous webhook business execution.
- Explicit service and route layers for demo explainability.
- Per-action and per-delivery history for transparent debugging and observability.
- Keep core behavior complete before optional features.
