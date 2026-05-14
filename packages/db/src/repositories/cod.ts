import type { PrismaClient } from "@prisma/client";

import { newId, type CodEntryKind } from "@usv/core";

import type { TxClient } from "../tx.js";

export interface InsertCodEntryInput {
  merchantId: string;
  shipmentId: string;
  carrier: string;
  kind: CodEntryKind;
  amountMinor: bigint;
  occurredAt: Date;
  remittanceId?: string;
  note?: string;
}

export const insertCodEntry = (client: PrismaClient | TxClient, input: InsertCodEntryInput) =>
  client.codLedgerEntry.create({
    data: {
      id: newId("codEntry"),
      merchantId: input.merchantId,
      shipmentId: input.shipmentId,
      carrier: input.carrier,
      kind: input.kind,
      amount: input.amountMinor,
      occurredAt: input.occurredAt,
      remittanceId: input.remittanceId ?? null,
      note: input.note ?? null,
    },
  });

/**
 * Per-shipment COD position = expected − collected − remitted ± adjustments.
 * Returned in minor units.
 */
export const codBalanceForShipment = async (db: PrismaClient, shipmentId: string): Promise<bigint> => {
  const entries = await db.codLedgerEntry.findMany({
    where: { shipmentId },
    select: { kind: true, amount: true },
  });
  let expected = 0n;
  let collected = 0n;
  let remitted = 0n;
  let adjusted = 0n;
  for (const e of entries) {
    if (e.kind === "expected") expected += e.amount;
    else if (e.kind === "collected") collected += e.amount;
    else if (e.kind === "remitted") remitted += e.amount;
    else if (e.kind === "adjusted") adjusted += e.amount;
  }
  return expected - collected - remitted + adjusted;
};
