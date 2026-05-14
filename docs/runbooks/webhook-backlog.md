# Webhook delivery backlog

## Symptoms

- `bullmq.waiting{queue=webhook-delivery}` > 1000.
- Merchant complaints that events are arriving late.
- `webhook_deliveries.status='pending'` rows growing without bound.

## Triage

1. Is the backlog from one bad endpoint (which we keep retrying) or all endpoints?
   ```sql
   SELECT endpoint_id, COUNT(*)
   FROM webhook_deliveries
   WHERE status IN ('pending', 'failed')
   GROUP BY endpoint_id
   ORDER BY 2 DESC LIMIT 20;
   ```
2. If concentrated on one endpoint: look at the last response body in the dashboard. If the endpoint is consistently 4xx, the merchant has a bug; deactivate the endpoint and notify them.
3. If spread across many endpoints: suspect our outbound path (DNS, proxy, certificate).

## Mitigation

- Scale worker replicas: `kubectl scale -n usv deploy/worker --replicas=8`.
- If a single endpoint is the culprit and the merchant is unresponsive, deactivate it:
  ```sql
  UPDATE webhook_endpoints SET active=false WHERE id='...';
  ```
- Once active=false, the next attempt skips delivery and the job exits cleanly.

## Recovery check

- Pending count drops below 100 and stays.
- p99 delivery latency < 30s.
- No new dead-lettered deliveries in the last 15 minutes.
