import type { RemittanceLineRaw } from "@usv/core";
import { vnd } from "@usv/core";

/**
 * Parse GHN's COD remittance report. GHN exposes both an API and an XLSX
 * download; this function accepts the API JSON shape. The XLSX path is
 * handled in `apps/worker` where we keep the parsing dependency.
 */
export interface GhnRemittanceApiLine {
  order_code: string;
  cod_amount: number;
  cod_collect_date: string;
  cod_transfer_date: string;
  cod_fee?: number;
}

export const ghnRemittanceLinesToRaw = (lines: GhnRemittanceApiLine[]): RemittanceLineRaw[] =>
  lines.map((l) => {
    const fee = l.cod_fee ?? 0;
    return {
      carrierTrackingCode: l.order_code,
      collectedAmount: vnd(l.cod_amount),
      feeAmount: vnd(fee),
      netAmount: vnd(l.cod_amount - fee),
      collectedAt: new Date(l.cod_collect_date).toISOString(),
      remittedAt: new Date(l.cod_transfer_date).toISOString(),
    };
  });
