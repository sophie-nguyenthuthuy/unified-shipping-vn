# 0007. Idempotency in Redis with body-hash check

Status: **accepted**
Date: 2026-05-14

## Context

Mutating endpoints (`POST /v1/shipments`, `POST /v1/shipments/:id/cancel`) must be safe to retry — networks fail, clients duplicate requests, infrastructure intermittently double-delivers. Without idempotency, retries create duplicate shipments and duplicate carrier API calls (and thus duplicate fees).

## Decision

`Idempotency-Key` header on mutating routes, 24h TTL. The pair `(merchantId, key)` is the cache key in Redis. The stored value is `{ hash, status, body }`:

- `hash` is `sha256(JSON.stringify(requestBody))`.
- On replay with a matching `hash`, we replay the stored response.
- On replay with a *different* `hash`, we fail 409 `idempotency_conflict` — the client reused a key for a different request, which is a bug to fix on their side.

The Fastify `idempotency` plugin captures responses in `onSend` and persists them; on cache hit it short-circuits before the handler runs.

## Consequences

- Storage is bounded: an idempotency record is ~1 KB; 24h × 1000 RPS = ~90M records = ~90 GB at saturation. Real load is far lower. TTL keeps Redis bounded.
- Cross-region replication is not required; idempotency is intentionally local to a region. Retries that cross regions get fresh keys.
- Long-running handlers can have their response captured after they finish — there's no lease, so two concurrent identical requests both run and the second one's response wins the cache. That's acceptable for our endpoints (carrier APIs themselves are not idempotent, but we pass the same `Idempotency-Key` through where the carrier supports it).

## Alternatives considered

- **Postgres-backed idempotency**: simpler durability story, but the latency on the hot path is higher and we'd be adding a write to every POST.
- **Distributed lock for concurrent requests with the same key**: rejected for the v1; complexity outweighs the rare double-execute risk.
