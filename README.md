# Unified Shipping VN

One API for Vietnamese last-mile carriers (GHN, GHTK, J&T Express, Viettel Post, Ninja Van) with first-class **COD reconciliation**.

> Status: **alpha** — GHN adapter is the reference implementation. GHTK / J&T / Viettel Post / Ninja Van ship with the common interface, contract tests, and HTTP stubs that need carrier-specific request/response mapping filled in. See [docs/STATUS.md](docs/STATUS.md).

## Why

Every Vietnamese merchant integrating five carriers writes the same code five times:

- Five different auth schemes (Bearer token, signed body, OAuth2 client credentials, username/password session).
- Five different status enumerations that don't agree on what "delivered" means.
- COD reconciliation done by downloading XLSX files from each carrier portal and matching by hand.

This service gives you:

- **One REST API** — quote rates, create shipments, print labels, track, cancel, schedule pickup.
- **One webhook stream** — normalized events with HMAC signatures, idempotency, automatic retry.
- **COD ledger + reconciliation dashboard** — automated three-way match between carrier remittance reports, our shipment ledger, and your bank settlements. Disputes are first-class.
- **Multi-tenant from day one** — API keys are scoped per merchant; carrier credentials live encrypted per merchant.
- **B2B SaaS now, PaaS later** — clean adapter contract means the "sandwich PaaS layer" (white-label carrier APIs, programmable routing, fulfillment marketplace) drops in without rewriting the core.

## Architecture

```
              ┌──────────────────────────────────────────────┐
              │              apps/dashboard (Next.js)         │
              └────────────────────┬─────────────────────────┘
                                   │  JWT (cookie)
                                   ▼
   ┌──────────┐    HMAC      ┌──────────────────┐    BullMQ    ┌──────────────┐
   │ Merchant │ ───────────► │  apps/api        │ ───────────► │ apps/worker  │
   │  client  │              │  (Fastify)       │              │ (BullMQ)     │
   └──────────┘              └────────┬─────────┘              └───────┬──────┘
                                      │                                │
                                      ▼                                ▼
                          ┌──────────────────────┐         ┌──────────────────────┐
                          │ packages/adapters    │         │ reconciliation cron  │
                          │  ├─ ghn (reference)  │         │ webhooks retry       │
                          │  ├─ ghtk             │         │ remittance import    │
                          │  ├─ jnt              │         └──────────┬───────────┘
                          │  ├─ viettelpost      │                    │
                          │  └─ ninjavan         │                    │
                          └──────────┬───────────┘                    │
                                     │                                │
                                     ▼                                ▼
                          ┌──────────────────────────────────────────────┐
                          │     Postgres (Prisma) + Redis (queues)        │
                          └──────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the ADRs under [docs/adr/](docs/adr/).

## Repo layout

```
apps/
  api/          Fastify HTTP API, OpenAPI spec, auth, rate limit, idempotency
  worker/       BullMQ workers: webhook ingest, retries, reconciliation cron
  dashboard/    Next.js 14 (App Router) admin/merchant dashboard
packages/
  core/         Domain types, errors, value objects (Money, Address, Phone)
  db/           Prisma schema, migrations, repositories
  adapters/     CarrierAdapter contract + 5 carrier implementations
  webhooks/     Inbound signature verification, normalization, outbound delivery
  reconciliation/  COD ledger, remittance matching engine, dispute state machine
  sdk-ts/       Public TypeScript SDK published as @usv/sdk
  observability/ OpenTelemetry, pino logger, Sentry wiring
  config/       Env loading + zod validation
  testing/      Test fixtures, MSW handlers, contract test helpers
infra/
  docker/       Dockerfiles
  k8s/          Plain manifests (dev)
  helm/         Helm chart (prod)
docs/
  ARCHITECTURE.md, SECURITY.md, STATUS.md
  adr/          Architecture decision records
  runbooks/     On-call procedures
  api/          OpenAPI spec
```

## Quick start

```bash
# Prereqs: Node 20+, pnpm 9+, Docker
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed                # creates a demo merchant + API key
pnpm dev                    # runs api (3000), worker, and dashboard (3001)
```

Verify:

```bash
curl -H "Authorization: Bearer $USV_API_KEY" http://localhost:3000/v1/healthz
```

## Production grade — what that means here

| Concern              | How it is addressed                                                                 |
|----------------------|-------------------------------------------------------------------------------------|
| Auth                 | API keys hashed (Argon2id) + peppered, scoped per merchant, rotatable, audit-logged |
| Idempotency          | `Idempotency-Key` header, 24h replay window, persisted in Redis with body hash       |
| Webhook integrity    | HMAC-SHA256 signatures (`X-USV-Signature`, `X-USV-Timestamp`), 5-minute window      |
| Rate limiting        | Per-merchant token bucket in Redis; default 600 rpm, overridable per plan           |
| Observability        | OpenTelemetry traces + metrics, structured pino logs, request IDs propagated         |
| Resiliency           | Per-adapter circuit breakers, exponential backoff, jittered retries, DLQ on BullMQ  |
| Multi-tenancy        | Row-level `merchant_id` on every table; repository helpers enforce scoping          |
| Data at rest         | Carrier credentials encrypted with envelope encryption (KMS key, AES-256-GCM)        |
| Schema evolution     | Prisma migrations checked in; shadow DB in CI; backward-compat additive default     |
| CI                   | Lint, typecheck, unit + contract + integration (testcontainers), CodeQL, SBOM        |
| Releases             | Changesets, semver, signed container images, Helm chart                              |
| Runbooks             | [docs/runbooks/](docs/runbooks/) for the five top incident types                    |

## Carrier coverage

| Carrier       | Quote | Create | Cancel | Track | Pickup | Webhook | COD remit import |
|---------------|:-----:|:------:|:------:|:-----:|:------:|:-------:|:----------------:|
| GHN           | ✅    | ✅     | ✅     | ✅    | ✅     | ✅      | ✅               |
| GHTK          | ✅    | ✅     | ✅     | ✅    | ✅     | ✅      | ✅               |
| J&T Express   | 🧱    | 🧱     | 🧱     | 🧱    | 🧱     | 🧱      | 🧱               |
| Viettel Post  | 🧱    | 🧱     | 🧱     | 🧱    | 🧱     | 🧱      | 🧱               |
| Ninja Van     | 🧱    | 🧱     | 🧱     | 🧱    | 🧱     | 🧱      | 🧱               |

✅ implemented · 🧱 interface + contract test in place, request/response mapping pending

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Status & roadmap](docs/STATUS.md)
- [OpenAPI spec](docs/api/openapi.yaml)
- [ADR index](docs/adr/README.md)
- [Runbooks](docs/runbooks/README.md)
- [Contributing](CONTRIBUTING.md)

## License

Apache-2.0 — see [LICENSE](LICENSE).
