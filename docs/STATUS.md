# Status & roadmap

> Honest accounting of what works, what's stubbed, and what's missing.

## Implemented

- Monorepo with strict TypeScript, ESLint, Prettier, Husky.
- Domain layer (`@usv/core`): types, errors, value objects, status state machine, normalized webhook events.
- Database schema (`@usv/db`): full multi-tenant model — merchants, API keys, carrier accounts (encrypted), shipments, tracking events, COD ledger, remittances + lines, reconciliation disputes, idempotency, audit log.
- Adapter contract (`@usv/adapters`): `CarrierAdapter` interface, shared HTTP client with retries + OTel, circuit breaker, registry.
- **GHN adapter**: quote, create, cancel, track, label, pickup, webhook signature verification + normalization. Status mapping table.
- **GHTK adapter**: quote, create, cancel, track, label, webhook (HMAC-SHA256, `X-Secure-Key`), full status mapping including return / on-hold / reconciled. Timestamp parsing handles GHTK's `+07:00`-without-suffix format. Remittance line normalizer.
- J&T / Viettel Post / Ninja Van adapters: HTTP client wired, credentials parsed, webhook signature verification implemented. Business request/response mapping **pending**.
- **KMS / envelope encryption (`@usv/crypto`)**: AES-256-GCM data keys wrapped by a KMS-managed KEK. `LocalKmsProvider` for dev/CI, `AwsKmsProvider` for prod (lazy-imported `@aws-sdk/client-kms` peer dep). Versioned wire format. `SecretStore.sealJson/openJson` is what API + worker use; carrier credentials and webhook signing secrets are sealed before any DB write.
- Reconciliation engine (`@usv/reconciliation`): ledger arithmetic, remittance matcher with tolerance, dispute state machine.
- Webhooks (`@usv/webhooks`): outbound HMAC signing, verification, delivery primitive with retry schedule.
- TypeScript SDK (`@usv/sdk`): quote, create, get, cancel, track. Retries, timeouts, structured errors.
- Fastify API (`@usv/api`): auth, idempotency, rate limit (Redis), OpenAPI/Swagger UI at `/docs`, request IDs, error handler, health/readiness, shipments, rates, webhook endpoints, inbound webhooks, reconciliation summary.
- Worker (`@usv/worker`): webhook delivery with exponential backoff + dead-letter, inbound Redis-stream fan-out, nightly reconciliation cron.
- Dashboard (`@usv/dashboard`): home, shipments list, reconciliation summary, login (Argon2id + JWT cookie).
- Docker: per-service Dockerfiles + docker-compose for local dev.
- k8s: namespace, deployments, service, HPA, ingress. Helm chart skeleton.
- CI: lint / typecheck / unit tests against real Postgres + Redis. CodeQL. Dependency review. Dependabot. Container build with provenance + SBOM.
- Tests: 30+ unit tests across `core`, `webhooks`, `reconciliation`, `adapters`. Per-carrier contract suite.

## Stubbed (interface present, logic pending)

- **J&T / Viettel Post / Ninja Van**: every `CarrierAdapter` method other than `parseWebhook` signature check throws `feature_disabled` until carrier-specific request/response mapping is filled in. Pattern is GHN / GHTK — copy and adapt.
- **GCP KMS / Vault Transit providers**: only `local` and `aws-kms` are implemented today. Adding a new provider is implementing one ~50-line file against `KmsProvider`.
- **Bank settlement matching (third leg of reconciliation)**: COD ledger and carrier remittance reports are in place. Matching against the merchant's actual bank settlement (via a bank API or CSV upload) is the next slice.
- **Dashboard sign-up flow + carrier account management UI**: only login is wired. Create-merchant and add-carrier-account UIs need building.
- **Remittance import job**: parses GHN's API shape (`packages/adapters/src/ghn/remittance-import.ts`). XLSX path (for carriers that only offer downloads) needs a parser in the worker.

## Not yet started

- SDKs for PHP and Python (most VN merchants are on PHP/Laravel).
- Shopify / WooCommerce / Haravan / Sapo connectors.
- Routing engine (auto-pick cheapest / fastest carrier per shipment).
- Multi-region active-active deployment.
- Compliance: SOC 2 readiness checklist, GDPR-style export/delete endpoints, NĐ 13/2023 data localisation review.

## Known limitations

- The Fastify rate limiter uses per-merchant token buckets keyed in Redis — no cross-instance sync issues, but no graceful degradation if Redis fails. (Falls back to in-memory.)
- Adapter circuit breakers are per-process; in multi-replica deployments, each replica trips independently. This is intentional for the v1 — adding a coordinated breaker is more risk than reward at low replica counts.
- `noUncheckedIndexedAccess` is on; some code uses `!` for hot paths where the invariant is local. Each instance is annotated where load-bearing.
