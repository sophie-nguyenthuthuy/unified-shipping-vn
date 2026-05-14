# 0003. BullMQ for async work

Status: **accepted**
Date: 2026-05-14

## Context

We have three distinct async workloads:

1. **Outbound webhook delivery** — at-least-once, with retry backoff up to 24h, dead-letter after 8 attempts.
2. **Inbound carrier-event fan-out** — read from a Redis stream, write to Postgres, enqueue per-endpoint deliveries.
3. **Reconciliation cron** — nightly job that fans out (merchant × carrier) reconciliation jobs.

## Decision

BullMQ on the Redis we already run. One queue per workload (`webhook-delivery`, `reconciliation`). Concurrency is per-worker; we scale by adding worker replicas.

## Consequences

- We get DLQs, repeatable jobs, and Bull's UI for free.
- Job state is in Redis, not Postgres. If we lose Redis, in-flight jobs are lost. **Mitigation**: every job's input is derived from durable Postgres state (`webhook_deliveries` table for delivery, `cod_ledger_entries` for reconciliation), so we can reconstruct the queue from a snapshot if we have to. This is documented in `docs/runbooks/redis-recovery.md`.
- Cron is BullMQ's repeatable jobs, not a separate scheduler. One fewer moving part.

## Alternatives considered

- **Temporal**: overkill for this scope; we'd be running an entire workflow engine for what amounts to "POST with retry."
- **Postgres-backed queue (`pg-boss`, `graphile-worker`)**: simpler ops, but we already have Redis and Postgres; using Postgres for both work and durable state would couple the two and complicate the read path.
- **AWS SQS**: would couple us to AWS. Defer until we know we want that.
