import type { FastifyInstance } from "fastify";

import {
  ConflictError,
  newId,
  NotFoundError,
  vnd,
  type CreateShipmentRequest,
  type ShipmentStatus,
} from "@usv/core";
import { insertShipment, updateShipmentStatus, findShipmentForMerchant, insertCodEntry } from "@usv/db";

import { resolveAdapter } from "./adapter-resolver.js";

export interface CreateShipmentInput {
  merchantId: string;
  body: CreateShipmentRequest;
  idempotencyKey?: string;
}

export const createShipmentService = async (app: FastifyInstance, input: CreateShipmentInput) => {
  const { merchantId, body } = input;

  const existing = await app.db.shipment.findUnique({
    where: { merchantId_merchantOrderId: { merchantId, merchantOrderId: body.merchantOrderId } as never },
  });
  if (existing) throw ConflictError("shipment with merchantOrderId already exists", { id: existing.id });

  const account = await app.db.carrierAccount.findFirst({
    where: { merchantId, carrier: body.carrier, active: true },
  });
  if (!account) throw NotFoundError(`carrier account for ${body.carrier}`);

  const adapter = await resolveAdapter(app, account);
  const created = await adapter.createShipment(body, {
    idempotencyKey: input.idempotencyKey ?? newId("shipment"),
  });

  const id = newId("shipment");
  const status: ShipmentStatus = "ready_to_pickup";
  const shipment = await app.db.$transaction(async (tx) => {
    const row = await insertShipment(tx, {
      id,
      merchantId,
      merchantOrderId: body.merchantOrderId,
      carrier: body.carrier,
      carrierAccountId: account.id,
      carrierTrackingCode: created.carrierTrackingCode,
      serviceLevel: body.serviceLevel ?? "standard",
      serviceCode: body.serviceCode,
      status,
      pickup: body.pickup as never,
      delivery: body.delivery as never,
      parcel: body.parcel as never,
      cashOnDeliveryAmt: BigInt(body.cashOnDelivery?.amount ?? 0),
      shippingFeeAmt: BigInt(created.fees.shippingFee.amount),
      insuranceFeeAmt: BigInt(created.fees.insuranceFee?.amount ?? 0),
      codFeeAmt: BigInt(created.fees.codFee?.amount ?? 0),
      totalFeeAmt: BigInt(created.fees.totalFee.amount),
      labelUrl: created.labelUrl,
      metadata: body.metadata as never,
    });

    if (body.cashOnDelivery && body.cashOnDelivery.amount > 0) {
      await insertCodEntry(tx, {
        merchantId,
        shipmentId: id,
        carrier: body.carrier,
        kind: "expected",
        amountMinor: BigInt(body.cashOnDelivery.amount),
        occurredAt: new Date(),
      });
    }
    return row;
  });

  return shipmentToWire(shipment);
};

export interface CancelInput {
  merchantId: string;
  shipmentId: string;
  reason?: string;
}

export const cancelShipmentService = async (app: FastifyInstance, input: CancelInput) => {
  const shipment = await findShipmentForMerchant(app.db, input.merchantId, input.shipmentId);
  if (!shipment) throw NotFoundError("shipment");
  const account = await app.db.carrierAccount.findUnique({ where: { id: shipment.carrierAccountId } });
  if (!account) throw NotFoundError("carrier account");
  const adapter = await resolveAdapter(app, account);
  await adapter.cancelShipment(shipment.carrierTrackingCode, { reason: input.reason });
  const updated = await updateShipmentStatus(app.db, { id: shipment.id, status: "cancelled", cancelledAt: new Date() });
  return shipmentToWire(updated);
};

export interface TrackInput {
  merchantId: string;
  shipmentId: string;
}

export const trackShipmentService = async (app: FastifyInstance, input: TrackInput) => {
  const shipment = await findShipmentForMerchant(app.db, input.merchantId, input.shipmentId);
  if (!shipment) throw NotFoundError("shipment");
  const account = await app.db.carrierAccount.findUnique({ where: { id: shipment.carrierAccountId } });
  if (!account) throw NotFoundError("carrier account");
  const adapter = await resolveAdapter(app, account);
  return adapter.track(shipment.carrierTrackingCode);
};

const shipmentToWire = (row: Record<string, unknown> & { id: string }): Record<string, unknown> => ({
  id: row.id,
  merchantId: row.merchantId,
  merchantOrderId: row.merchantOrderId,
  carrier: row.carrier,
  carrierTrackingCode: row.carrierTrackingCode,
  serviceLevel: row.serviceLevel,
  status: row.status,
  shippingFee: vnd(Number(row.shippingFeeAmt as bigint)),
  insuranceFee: row.insuranceFeeAmt ? vnd(Number(row.insuranceFeeAmt as bigint)) : undefined,
  codFee: row.codFeeAmt ? vnd(Number(row.codFeeAmt as bigint)) : undefined,
  totalFee: vnd(Number(row.totalFeeAmt as bigint)),
  cashOnDelivery:
    row.cashOnDeliveryAmt && (row.cashOnDeliveryAmt as bigint) > 0n
      ? vnd(Number(row.cashOnDeliveryAmt as bigint))
      : undefined,
  labelUrl: row.labelUrl,
  createdAt: (row.createdAt as Date | undefined)?.toISOString(),
  updatedAt: (row.updatedAt as Date | undefined)?.toISOString(),
});
