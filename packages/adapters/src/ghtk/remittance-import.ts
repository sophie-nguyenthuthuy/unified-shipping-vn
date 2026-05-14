import type { RemittanceLineRaw } from "@usv/core";
import { vnd } from "@usv/core";

import type { GhtkRemittanceLine } from "./types.js";

/**
 * GHTK remittance reports come through their partner API as JSON arrays.
 * For accounts on the legacy plan that only have XLSX downloads, an XLSX
 * parser lives in `apps/worker/src/jobs/import-ghtk-xlsx.ts` and feeds the
 * same shape into this normaliser.
 *
 * Note the field semantics:
 *   - `pick_money`  is the gross COD collected from the buyer.
 *   - `fee`          is GHTK's shipping fee for this shipment.
 *   - `total_collect` is the net amount GHTK remitted to the merchant
 *                     (`pick_money - fee - insurance_fee` in their accounting).
 */
export const ghtkRemittanceLinesToRaw = (lines: GhtkRemittanceLine[]): RemittanceLineRaw[] =>
  lines.map((l) => {
    const collected = l.pick_money;
    const fee = l.fee + (l.insurance_fee ?? 0);
    // Trust `total_collect` from the carrier where present; otherwise compute.
    const net = l.total_collect ?? collected - fee;
    return {
      carrierTrackingCode: l.label_id,
      collectedAmount: vnd(collected),
      feeAmount: vnd(fee),
      netAmount: vnd(Math.max(0, net)),
      collectedAt: l.delivered_date ? new Date(l.delivered_date).toISOString() : undefined,
      remittedAt: l.paid_date ? new Date(l.paid_date).toISOString() : undefined,
    };
  });
