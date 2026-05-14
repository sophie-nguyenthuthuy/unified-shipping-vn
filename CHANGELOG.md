# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **GHTK adapter** fully implemented: quote, create, cancel, track, label, pickup, webhook (`X-Secure-Key` HMAC-SHA256), status mapping for all known GHTK status_id values including return/reconciled, `+07:00`-without-suffix timestamp parser, remittance line normalizer.
- **`@usv/crypto` package** with envelope encryption (AES-256-GCM data keys, KMS-wrapped KEK) and pluggable providers (`LocalKmsProvider` for dev/CI, `AwsKmsProvider` for prod via optional `@aws-sdk/client-kms` peer dep). Versioned wire format with `encodeEnvelope` / `decodeEnvelope`.
- `apps/api`: `POST /v1/carrier-accounts` now seals carrier credentials before writing. `POST /v1/webhook-endpoints` seals the outbound signing secret. `POST /v1/webhooks/inbound/:carrier` decrypts the per-account `webhookSecret` to verify carrier signatures.
- `apps/worker`: webhook delivery now decrypts the endpoint secret via the same `SecretStore`.
- `@usv/config` adds `USV_KMS_PROVIDER` and `USV_KMS_DEFAULT_KEY_ID` validation.
- Monorepo scaffolding (pnpm + turbo).
- `packages/core` domain types, errors, value objects.
- `packages/db` Prisma schema with multi-tenant shipment + COD ledger model.
- `packages/adapters` `CarrierAdapter` interface, GHN reference implementation, scaffolds for GHTK / J&T / Viettel Post / Ninja Van.
- `packages/webhooks` HMAC signature verification, normalization, idempotency.
- `packages/reconciliation` COD ledger and three-way matching engine.
- `packages/sdk-ts` typed client with retries and OTel.
- `apps/api` Fastify server with auth, rate limit, idempotency, OpenAPI.
- `apps/worker` BullMQ workers for webhook delivery and reconciliation cron.
- `apps/dashboard` Next.js 14 dashboard.
- Docker Compose, k8s manifests, Helm chart skeleton.
- GitHub Actions CI: lint, typecheck, test, build, CodeQL, container build.
