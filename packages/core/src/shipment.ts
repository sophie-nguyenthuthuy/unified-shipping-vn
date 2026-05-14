import { z } from "zod";

import { Address } from "./address.js";
import { CarrierCode, ServiceLevel } from "./carrier.js";
import { Money } from "./money.js";
import { Parcel } from "./parcel.js";
import { ShipmentStatus } from "./status.js";

export const CreateShipmentRequest = z.object({
  merchantOrderId: z.string().min(1).max(64),
  carrier: CarrierCode,
  serviceLevel: ServiceLevel.optional(),
  serviceCode: z.string().optional(),
  pickup: Address,
  delivery: Address,
  parcel: Parcel,
  /** When set, the merchant requires the carrier to collect this from the buyer on delivery. */
  cashOnDelivery: Money.optional(),
  note: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});
export type CreateShipmentRequest = z.infer<typeof CreateShipmentRequest>;

export const Shipment = z.object({
  id: z.string(),
  merchantId: z.string(),
  merchantOrderId: z.string(),
  carrier: CarrierCode,
  carrierTrackingCode: z.string(),
  serviceLevel: ServiceLevel,
  status: ShipmentStatus,
  cashOnDelivery: Money.optional(),
  shippingFee: Money,
  insuranceFee: Money.optional(),
  codFee: Money.optional(),
  totalFee: Money,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deliveredAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  labelUrl: z.string().url().optional(),
});
export type Shipment = z.infer<typeof Shipment>;

export const CancelShipmentRequest = z.object({
  reason: z.string().max(200).optional(),
});
export type CancelShipmentRequest = z.infer<typeof CancelShipmentRequest>;
