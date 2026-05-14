# Architecture

## Goals

1. **One API surface** that hides carrier idiosyncrasies. Merchants integrate once.
2. **Honest about COD.** The carrier collects cash from the buyer, takes a cut, and remits later. We model that explicitly as a ledger and reconcile it daily.
3. **Boring tech.** Postgres + Redis + Node. No exotic dependencies. Everything is debuggable from `psql`, `redis-cli`, and structured logs.
4. **PaaS-ready.** The `CarrierAdapter` interface is the seam where third parties can plug in. The same seam supports a future "carrier marketplace" where merchants choose routing strategies (cheapest / fastest / least returns).

## High-level shape

- `apps/api` — HTTP entry point. Stateless. Authenticates API keys, validates input with Zod, persists data, calls carriers via adapters, enqueues async work.
- `apps/worker` — BullMQ workers. Three jobs: outbound webhook delivery, inbound carrier-event fan-out, and the nightly reconciliation cron.
- `apps/dashboard` — Next.js 14 (App Router). Server components read directly from Postgres for the merchant UI.
- `packages/adapters` — One module per carrier behind a common interface (`CarrierAdapter`).
- `packages/reconciliation` — Pure functions: ledger arithmetic, remittance matcher, dispute state machine.
- `packages/webhooks` — Outbound signing (`t=,v1=`) and the delivery primitive used by the worker.
- `packages/core` — Domain types and errors shared by everything.

## Request flow: create shipment

```
client ──POST /v1/shipments──► api
                                │
                                ▼
                          Zod validate
                                │
                                ▼
                      auth + idempotency
                                │
                                ▼
                      tx { merchants /
                            carrier_accounts
                            lookup }
                                │
                                ▼
                CarrierAdapter.createShipment ──► carrier API
                                │
                                ▼
                      tx { shipments insert,
                            cod_ledger_entries
                            "expected" insert }
                                │
                                ▼
                  201 with normalized shipment
```

## Event flow: carrier → us → merchant

```
carrier ──POST /v1/webhooks/inbound/{carrier}──► api
                                │
                                ▼
                  signature verified by adapter
                                │
                                ▼
                inbound_webhooks insert (idempotent on payload hash)
                                │
                                ▼
                XADD usv:inbound-events ◄── Redis stream
                                │
                                ▼
                            worker (inbound-fanout)
                                │
                                ▼
                  webhook_events insert,
                  webhook_deliveries insert per active endpoint
                                │
                                ▼
                            worker (delivery)
                                │
                                ▼
                merchant endpoint ◄── HMAC-signed POST
                                │
                       retry with backoff or dead-letter
```

## Reconciliation flow

```
nightly cron (worker) ──► fan out (merchant × carrier)
                                │
                                ▼
                          load expected entries,
                          load unmatched remittance lines
                                │
                                ▼
                      matchRemittance() (pure)
                                │
                                ▼
                ─►  remittance_lines.matched=true (matched)
                ─►  reconciliation_disputes insert (mismatch/duplicate/missing)
                ─►  cod_ledger_entries "remitted" / "adjusted" insert
```

## Data model highlights

- `merchants` — tenant root. Everything else cascades from here.
- `api_keys` — Argon2id-hashed, peppered, lookup by 8-char prefix then verify candidates in memory.
- `carrier_accounts` — per-merchant carrier credentials, **envelope-encrypted with KMS**. `config` (JSONB) holds non-secret metadata.
- `shipments` — one row per shipment. Money in BigInt minor units; the wire format converts via `Money`.
- `cod_ledger_entries` — append-only. The balance for any shipment is computed by aggregation.
- `remittances` + `remittance_lines` — what the carrier says they paid us.
- `reconciliation_disputes` — exceptions surfaced from the matcher; explicit state machine.
- `inbound_webhooks` — every carrier-side webhook, indexed on `(carrier, payload_hash)` for idempotency.
- `webhook_events` + `webhook_deliveries` — what we owe merchants; deliveries track retries.

## Idempotency model

- Inbound from merchants: `Idempotency-Key` header on mutating routes, 24h TTL in Redis with body-hash check. Replay returns the cached response; key reuse with a different body fails 409.
- Inbound from carriers: keyed on `sha256(rawBody)` so the same carrier event is processed exactly once.
- Outbound to carriers: adapters pass the same `Idempotency-Key` through whenever the carrier supports it (GHN does, others don't — we still track at our boundary).
- Outbound to merchants: the worker is the only writer to `webhook_deliveries`; a unique `eventId+endpointId` row prevents duplicate fan-out.

## Failure model

| Failure                                  | Behavior                                                                                 |
|------------------------------------------|------------------------------------------------------------------------------------------|
| Carrier 5xx / network                    | Adapter retries with jittered backoff; circuit breaker opens after N consecutive fails.  |
| Carrier 4xx                              | Surface as `UsvError(code: "carrier_error", retryable: false)` with carrier details.     |
| Webhook delivery fails                   | BullMQ schedules next attempt per `nextRetryDelaySeconds`. After 8 attempts → DLQ.       |
| Reconciliation mismatch                  | Open a `ReconciliationDispute`. Never silently drift the ledger.                          |
| DB unique-constraint conflict on shipment | 409 to the caller (`shipment with merchantOrderId already exists`).                      |
| Redis unavailable                        | API degrades: rate limiting + idempotency fall back to in-memory; new webhooks queued in DB. |

## Multi-tenancy

Every tenant-scoped table carries `merchantId`. Repository helpers expect the
caller to pass it in, so route handlers can't accidentally cross-tenant. The
dashboard's session contains the merchant id and server components read with
that filter on every query.

For B2B SaaS, this is sufficient. For PaaS (white-label carriers reselling to
their own customers), a future `tenants` parent above `merchants` slots in
without schema rework — just add a column and propagate.
