import type { CodEntryKind } from "@usv/core";

export interface LedgerEntry {
  kind: CodEntryKind;
  amountMinor: bigint;
}

/**
 * Per-shipment COD position:
 *   balance = expected − collected − remitted + adjusted
 *
 *   - balance == 0  → fully settled
 *   - balance >  0  → carrier still owes us this amount
 *   - balance <  0  → we received too much; investigate
 */
export const codBalance = (entries: LedgerEntry[]): bigint => {
  let expected = 0n;
  let collected = 0n;
  let remitted = 0n;
  let adjusted = 0n;
  for (const e of entries) {
    if (e.kind === "expected") expected += e.amountMinor;
    else if (e.kind === "collected") collected += e.amountMinor;
    else if (e.kind === "remitted") remitted += e.amountMinor;
    else if (e.kind === "adjusted") adjusted += e.amountMinor;
  }
  return expected - collected - remitted + adjusted;
};

export interface MerchantCodSummary {
  shipmentCount: number;
  totalExpectedMinor: bigint;
  totalCollectedMinor: bigint;
  totalRemittedMinor: bigint;
  outstandingMinor: bigint;
}

export const summarizeMerchant = (
  perShipment: Array<{ shipmentId: string; entries: LedgerEntry[] }>,
): MerchantCodSummary => {
  let expected = 0n;
  let collected = 0n;
  let remitted = 0n;
  let adjusted = 0n;
  for (const { entries } of perShipment) {
    for (const e of entries) {
      if (e.kind === "expected") expected += e.amountMinor;
      else if (e.kind === "collected") collected += e.amountMinor;
      else if (e.kind === "remitted") remitted += e.amountMinor;
      else if (e.kind === "adjusted") adjusted += e.amountMinor;
    }
  }
  return {
    shipmentCount: perShipment.length,
    totalExpectedMinor: expected,
    totalCollectedMinor: collected,
    totalRemittedMinor: remitted,
    outstandingMinor: expected - collected - remitted + adjusted,
  };
};
