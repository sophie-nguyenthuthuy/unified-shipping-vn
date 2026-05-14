# Carrier outage

## Symptoms

- Surge in `usv.errors.code="carrier_unavailable"` for a single carrier.
- `carrier_request_duration_ms{carrier=X}` p99 > 30s.
- Adapter circuit breaker opens (look for "circuit_open" in worker logs).

## Triage

1. Confirm the outage is carrier-side, not ours. Hit the carrier's public status page and run the carrier-side smoke test:
   ```bash
   pnpm tsx scripts/carrier-smoke.ts --carrier=ghn
   ```
   If our requests are succeeding from a developer laptop but failing from prod, suspect a NAT / IP-allowlist issue, not a carrier outage.
2. Check the merchant impact: `SELECT COUNT(*) FROM shipments WHERE carrier='X' AND status='pending' AND created_at > now() - interval '15 min'`.

## Mitigation

- If the outage is global to that carrier, update the status page and let the breaker do its job — calls fail fast, and the API returns `carrier_unavailable` with `retryable: true`, prompting clients to retry later.
- If specific merchants need to ship now, suggest fallback carriers via the rate quote endpoint. (Routing is currently merchant-driven; the automatic fallback is on the roadmap.)
- Do NOT manually retry pending shipments by hand. The carrier may have created them; you risk duplicates. Wait for the carrier to recover.

## Recovery check

- `carrier_request_duration_ms{carrier=X}` p99 < 5s for 10 minutes.
- Breaker transitions back to `closed`.
- `pending` shipments older than 1 hour have either created or been cancelled.

## Postmortem

Open a postmortem template if merchant-facing for more than 30 minutes or if any data integrity issue is observed.
