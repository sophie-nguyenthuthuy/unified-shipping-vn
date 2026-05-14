import { z } from "zod";

import { CarrierCode } from "./carrier.js";
import { Money } from "./money.js";

export const CodEntryKind = z.enum([
  "expected", // shipment created with COD amount
  "collected", // carrier confirmed cash collection from buyer
  "remitted", // carrier has remitted to merchant settlement account
  "adjusted", // remittance differs from expected; delta entry
  "disputed", // entry flagged for human review
]);
export type CodEntryKind = z.infer<typeof CodEntryKind>;

export const CodLedgerEntry = z.object({
  id: z.string(),
  merchantId: z.string(),
  shipmentId: z.string(),
  carrier: CarrierCode,
  kind: CodEntryKind,
  amount: Money,
  occurredAt: z.string().datetime(),
  remittanceId: z.string().optional(),
  note: z.string().optional(),
});
export type CodLedgerEntry = z.infer<typeof CodLedgerEntry>;

export const RemittanceLineRaw = z.object({
  carrierTrackingCode: z.string(),
  collectedAmount: Money,
  feeAmount: Money,
  netAmount: Money,
  collectedAt: z.string().datetime().optional(),
  remittedAt: z.string().datetime().optional(),
});
export type RemittanceLineRaw = z.infer<typeof RemittanceLineRaw>;

export const Remittance = z.object({
  id: z.string(),
  merchantId: z.string(),
  carrier: CarrierCode,
  reportPeriodStart: z.string().datetime(),
  reportPeriodEnd: z.string().datetime(),
  totalGross: Money,
  totalFees: Money,
  totalNet: Money,
  lineCount: z.number().int().nonnegative(),
  sourceFilename: z.string().optional(),
  importedAt: z.string().datetime(),
});
export type Remittance = z.infer<typeof Remittance>;
