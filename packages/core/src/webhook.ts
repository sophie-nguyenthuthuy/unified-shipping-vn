import { z } from "zod";

import { CarrierCode } from "./carrier.js";
import { Money } from "./money.js";
import { ShipmentStatus } from "./status.js";

export const WebhookEventType = z.enum([
  "shipment.created",
  "shipment.status_changed",
  "shipment.delivered",
  "shipment.cancelled",
  "shipment.returned",
  "shipment.delivery_failed",
  "cod.collected",
  "cod.remitted",
  "reconciliation.dispute_opened",
  "reconciliation.dispute_resolved",
]);
export type WebhookEventType = z.infer<typeof WebhookEventType>;

export const WebhookEvent = z.object({
  id: z.string(),
  type: WebhookEventType,
  occurredAt: z.string().datetime(),
  merchantId: z.string(),
  data: z.unknown(),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;

export const ShipmentStatusChangedPayload = z.object({
  shipmentId: z.string(),
  carrier: CarrierCode,
  carrierTrackingCode: z.string(),
  merchantOrderId: z.string(),
  previousStatus: ShipmentStatus.optional(),
  status: ShipmentStatus,
  occurredAt: z.string().datetime(),
});
export type ShipmentStatusChangedPayload = z.infer<typeof ShipmentStatusChangedPayload>;

export const CodCollectedPayload = z.object({
  shipmentId: z.string(),
  carrierTrackingCode: z.string(),
  amount: Money,
  collectedAt: z.string().datetime(),
});
export type CodCollectedPayload = z.infer<typeof CodCollectedPayload>;
