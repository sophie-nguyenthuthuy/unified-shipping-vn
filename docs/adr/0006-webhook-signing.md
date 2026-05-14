# 0006. Webhook signing scheme

Status: **accepted**
Date: 2026-05-14

## Context

Merchants need to verify that webhooks claiming to be from us actually are. The verification has to be cheap, the format has to be unambiguous, and we have to be able to rotate signing secrets without coordinated downtime on the merchant side.

## Decision

Per-endpoint HMAC-SHA256 signing. Headers:

- `X-USV-Timestamp: <unix seconds>`
- `X-USV-Signature: t=<ts>,v1=<hex hmac-sha256 of "${ts}.${body}">`

Verification rejects timestamps more than 5 minutes outside the verifier's clock. The `v<N>` prefix on the signature lets us roll a new scheme later (e.g. Ed25519 → `v2=`) and have merchants accept both during the transition.

## Consequences

- The format is borrowed deliberately from Stripe's webhook signing; many merchants will recognise it.
- Rotation: new secrets create new endpoints; the old endpoint deactivates after the merchant confirms the cut-over. We do not rotate the secret on an existing endpoint, because the merchant can't atomically swap on their side.
- Replay is bounded to 5 minutes by the timestamp tolerance, plus the merchant's own idempotency on `X-USV-Event-Id`.

## Alternatives considered

- **JWT** (RS256 / EdDSA): heavier, key management is harder, and merchants need a JWT library.
- **Single shared secret across all endpoints**: rejected; blast radius of a leak is the whole account.
