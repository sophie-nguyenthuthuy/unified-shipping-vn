# Reconciliation dispute spike

## Symptoms

- `reconciliation_disputes_opened_total{kind=X}` rate > baseline × 3.
- Dashboard "Open disputes" panel grows without resolution.

## Triage

1. Is the spike concentrated on a single carrier? `kind=missing_remittance` for `carrier='ghtk'`?
2. If yes, the carrier may have shifted their remittance schedule. Confirm with the carrier's billing portal or the merchant's account manager before opening tickets.
3. `kind=amount_mismatch` spikes: check if the carrier introduced a new fee structure. Compare `RemittanceLine.fee_amt` against `Shipment.cod_fee_amt` — if the former is consistently higher, we need to update fee handling.

## Mitigation

- Disputes are append-only and have a state machine; never resolve by deleting rows.
- For confirmed carrier-side issues, batch-transition disputes to `awaiting_response` and reference the carrier ticket id in `notes`.
- For confirmed false positives (e.g. our matcher tolerance too tight), open a code fix; never widen tolerance silently — that hides real losses.

## Recovery check

- Disputes-opened rate returns to baseline.
- Open dispute count trending down (resolution rate > opening rate).
- No silent ledger adjustments in `audit_logs` from operators bypassing the matcher.
