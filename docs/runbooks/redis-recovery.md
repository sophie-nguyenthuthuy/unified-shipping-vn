# Redis unavailable

## Symptoms

- API health: `/v1/readyz` returns 503.
- Rate limiter falls back to in-memory; cross-instance limits are no longer coordinated.
- BullMQ workers fail to dequeue.

## Triage

1. Distinguish "Redis is down" from "Redis is full". `redis-cli info memory` and `redis-cli info clients`.
2. If `maxmemory` is being hit, look for unbounded keys — most often, an idempotency key leak (`idem:*`) past TTL because the cleanup hook didn't run.

## Mitigation

- API: requests with idempotency keys will still succeed (the plugin proceeds without cache on Redis miss), but a duplicate request can create a duplicate shipment if it races. Tell oncall to suspend high-throughput merchants for the duration.
- Worker: no work is processed while Redis is down. Persisted state in Postgres (`webhook_deliveries`, `cod_ledger_entries`) is unaffected; we'll catch up when Redis comes back.
- If Redis state is unrecoverable, the worker has a startup hook to rehydrate pending `webhook_deliveries` from Postgres into the queue. Run `pnpm --filter @usv/worker exec node dist/scripts/rehydrate.js` after Redis is back up.

## Recovery check

- `/v1/readyz` returns 200 for 5 minutes.
- BullMQ queue depths return to baseline within an hour.
- No DLQ growth attributable to the outage.
