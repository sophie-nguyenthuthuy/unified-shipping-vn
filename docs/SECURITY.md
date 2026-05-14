# Security model

## Threat model

| Threat                                   | Mitigation                                                                     |
|------------------------------------------|--------------------------------------------------------------------------------|
| Leaked API key                           | Argon2id hash + 32-byte server-side pepper; rotatable; revocable in seconds.    |
| Brute-force on API key prefix            | Argon2id is intentionally slow; per-IP rate limit on 401 responses.            |
| Carrier credential theft from DB dump    | `carrier_accounts.encryptedSecret` is envelope-encrypted (AES-256-GCM via KMS). |
| Webhook forgery (carrier → us)           | HMAC / digest verified inside each adapter before any state change.            |
| Webhook forgery (us → merchant)          | We sign with HMAC-SHA256 over `${ts}.${body}` and reject if `|now-ts| > 5min`.   |
| Webhook replay                           | 5-minute timestamp tolerance + idempotency on event id at the merchant side.   |
| Idempotency key replay with new body     | 409 `idempotency_conflict`; clients must use a fresh key for new requests.     |
| Cross-tenant data access                 | `merchantId` enforced at the repository layer; ESLint rule blocks raw queries. |
| SQL injection                            | Prisma parameterized everywhere; no string concatenation in queries.            |
| Prototype pollution / RCE in deps        | Dependabot + Dependency Review action + CodeQL.                                 |
| Sensitive logs                           | pino redaction (`authorization`, `cookie`, `password*`, `secret*`, `token*`).   |
| Container escape                         | `runAsNonRoot`, `readOnlyRootFilesystem`, dropped capabilities, seccomp default. |
| Image supply chain                       | GHCR with provenance + SBOM (`docker/build-push-action@v6`).                    |

## Key rotation

- API keys are revoked instantly and replaced via the dashboard.
- The `API_KEY_PEPPER` is rotated by adding a new pepper, running a one-off
  job to rehash every existing key with the new pepper, then removing the old
  value. Rotations are logged in `audit_logs`.
- Webhook signing secrets rotate by creating a new endpoint and deactivating
  the old one; we do not rotate in place, since merchants can't atomically
  swap the secret on their side.

## Data classification

- **Confidential (encrypted at rest, redacted in logs):** carrier credentials,
  API key plaintext (never persisted), webhook signing secrets, user
  password hashes.
- **PII (encrypted at rest, restricted access):** shipment pickup/delivery
  names, phones, addresses; remittance line beneficiary names.
- **Internal:** request/response logs, audit entries.
- **Public:** OpenAPI spec, status enums, error code list.

## Responsible disclosure

See [SECURITY.md](../SECURITY.md) at the repo root.
