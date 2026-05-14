# API key compromise

## Symptoms

- A merchant reports a leaked key, OR
- We detect anomalous patterns: requests from new geographies, sudden spike in shipment creation volume.

## Immediate action (< 2 minutes)

```sql
UPDATE api_keys SET revoked_at = now() WHERE id = '<id>';
```

The auth plugin checks `revoked_at` on every request; revocation is effective on the next request. Cached idempotency entries from the compromised key remain replayable for 24h — this is fine because they cannot trigger new side effects.

## Follow-up (< 1 hour)

1. Identify the requests made with the key in the last 24h. Use the request log (`audit_logs.actor_id = <api_key_id>`) and the application log stream filtered on the request id.
2. For any shipments created that the merchant did not authorise: cancel them via the carrier API (`POST /v1/shipments/:id/cancel`) and notify the carrier.
3. Issue a new key in the dashboard; the merchant must update their client.

## Forensics

- Pull the access log for the key id over the past 30 days.
- Check whether the key prefix appeared in any public source (GitHub search, Pastebin) — this informs how to rotate the `API_KEY_PEPPER` if multiple keys leaked the same way.

## Recovery check

- The compromised key is revoked.
- A new key is issued and in use by the merchant.
- All unauthorised shipments are cancelled and reconciled.
- Postmortem opened.
