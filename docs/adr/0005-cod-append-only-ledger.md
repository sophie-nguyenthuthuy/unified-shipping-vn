# 0005. COD as an append-only ledger

Status: **accepted**
Date: 2026-05-14

## Context

COD reconciliation is the single biggest pain point for VN merchants. Each carrier collects money from buyers on our behalf, takes a fee, and remits later — usually 2-7 days, often longer. Merchants today reconcile this by downloading XLSX files from each carrier portal and matching by hand. Disputes happen weeks after the fact, and the audit trail evaporates.

## Decision

COD is an **append-only ledger**, `cod_ledger_entries`, with five kinds of entries: `expected`, `collected`, `remitted`, `adjusted`, `disputed`. The balance for any shipment is computed as `expected − collected − remitted + adjusted`. No row is ever mutated; corrections are new `adjusted` entries.

`Remittance` and `RemittanceLine` are the carrier's claims of what they paid us. They are *not* the ledger — they are evidence the ledger consumes.

`ReconciliationDispute` is opened when the matcher finds a discrepancy. It has an explicit state machine (see `packages/reconciliation/src/dispute.ts`).

## Consequences

- Every COD position is auditable to the second. "Why does this shipment show 50,000 ₫ outstanding?" is answered by listing its ledger entries.
- Storage cost is higher than a single-row-per-shipment model, but trivial (an entry is ~100 bytes; 10M shipments × 5 entries = 5 GB).
- Migrations that change financial semantics are *forbidden* — we add a new kind of entry instead.
- The dispute state machine prevents "fixing" a dispute by silently editing rows; the only path forward is a documented transition.

## Alternatives considered

- **Mutable balance column on `shipments`**: rejected. Lose the audit trail; race conditions on concurrent updates.
- **Generic double-entry accounting (debits/credits)**: overkill for this domain. We don't have multiple internal accounts to balance against.
