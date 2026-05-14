/**
 * COD reconciliation matcher.
 *
 * Inputs:
 *   - our COD ledger ("expected" entries created when a shipment with COD was created)
 *   - the carrier's remittance report (parsed into raw lines)
 *
 * Output: a classification per remittance line and per unmatched expected entry,
 * which the caller persists and uses to open `ReconciliationDispute` rows.
 *
 * Matching is exact on (carrier_tracking_code, amount). Amount tolerance is
 * configurable; small VND rounding differences (≤ 1) are auto-accepted.
 */

export interface ExpectedEntry {
  shipmentId: string;
  carrierTrackingCode: string;
  amountMinor: bigint;
}

export interface RemittanceLine {
  id: string;
  carrierTrackingCode: string;
  collectedMinor: bigint;
  feeMinor: bigint;
  netMinor: bigint;
}

export type LineClassification =
  | { kind: "matched"; shipmentId: string; lineId: string }
  | { kind: "amount_mismatch"; shipmentId: string; lineId: string; expectedMinor: bigint; actualMinor: bigint }
  | { kind: "duplicate"; lineIds: string[]; shipmentId: string }
  | { kind: "unmatched_line"; lineId: string }
  | { kind: "unmatched_expected"; shipmentId: string; carrierTrackingCode: string };

export interface MatchOptions {
  /** Auto-accept |Δ| ≤ toleranceMinor as a match (default: 1 VND). */
  toleranceMinor?: bigint;
}

export const matchRemittance = (
  expected: ExpectedEntry[],
  lines: RemittanceLine[],
  opts: MatchOptions = {},
): LineClassification[] => {
  const tolerance = opts.toleranceMinor ?? 1n;
  const expectedByCode = new Map<string, ExpectedEntry>();
  for (const e of expected) expectedByCode.set(e.carrierTrackingCode, e);

  const linesByCode = new Map<string, RemittanceLine[]>();
  for (const l of lines) {
    const arr = linesByCode.get(l.carrierTrackingCode);
    if (arr) arr.push(l);
    else linesByCode.set(l.carrierTrackingCode, [l]);
  }

  const results: LineClassification[] = [];
  const matchedLineIds = new Set<string>();

  for (const [code, group] of linesByCode) {
    const exp = expectedByCode.get(code);
    if (!exp) {
      for (const l of group) results.push({ kind: "unmatched_line", lineId: l.id });
      continue;
    }
    if (group.length > 1) {
      results.push({ kind: "duplicate", lineIds: group.map((l) => l.id), shipmentId: exp.shipmentId });
      group.forEach((l) => matchedLineIds.add(l.id));
      continue;
    }
    const line = group[0]!;
    const delta = line.collectedMinor - exp.amountMinor;
    if (delta > -tolerance && delta < tolerance) {
      results.push({ kind: "matched", shipmentId: exp.shipmentId, lineId: line.id });
    } else {
      results.push({
        kind: "amount_mismatch",
        shipmentId: exp.shipmentId,
        lineId: line.id,
        expectedMinor: exp.amountMinor,
        actualMinor: line.collectedMinor,
      });
    }
    matchedLineIds.add(line.id);
  }

  for (const [code, exp] of expectedByCode) {
    if (!linesByCode.has(code)) {
      results.push({ kind: "unmatched_expected", shipmentId: exp.shipmentId, carrierTrackingCode: code });
    }
  }

  return results;
};
