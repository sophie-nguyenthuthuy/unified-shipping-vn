import { Prisma, type PrismaClient } from "@prisma/client";
import type { ShipmentStatus } from "@usv/core";

import type { TxClient } from "../tx.js";

export interface CreateShipmentRecord {
  id: string;
  merchantId: string;
  merchantOrderId: string;
  carrier: string;
  carrierAccountId: string;
  carrierTrackingCode: string;
  serviceLevel: string;
  serviceCode?: string;
  status: ShipmentStatus;
  pickup: Prisma.InputJsonValue;
  delivery: Prisma.InputJsonValue;
  parcel: Prisma.InputJsonValue;
  cashOnDeliveryAmt: bigint;
  shippingFeeAmt: bigint;
  insuranceFeeAmt: bigint;
  codFeeAmt: bigint;
  totalFeeAmt: bigint;
  labelUrl?: string;
  metadata?: Prisma.InputJsonValue;
}

export const insertShipment = (client: PrismaClient | TxClient, input: CreateShipmentRecord) =>
  client.shipment.create({
    data: {
      ...input,
      serviceCode: input.serviceCode ?? null,
      labelUrl: input.labelUrl ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });

export const findShipmentForMerchant = (db: PrismaClient, merchantId: string, id: string) =>
  db.shipment.findFirst({ where: { id, merchantId } });

export const findShipmentByCarrierCode = (db: PrismaClient, carrier: string, code: string) =>
  db.shipment.findUnique({ where: { carrier_carrierTrackingCode: { carrier, code } as never } });

export interface UpdateShipmentStatusInput {
  id: string;
  status: ShipmentStatus;
  deliveredAt?: Date;
  cancelledAt?: Date;
  pickedUpAt?: Date;
}

export const updateShipmentStatus = (
  client: PrismaClient | TxClient,
  input: UpdateShipmentStatusInput,
) =>
  client.shipment.update({
    where: { id: input.id },
    data: {
      status: input.status,
      deliveredAt: input.deliveredAt ?? undefined,
      cancelledAt: input.cancelledAt ?? undefined,
      pickedUpAt: input.pickedUpAt ?? undefined,
    },
  });

export interface ListShipmentsQuery {
  merchantId: string;
  status?: ShipmentStatus;
  carrier?: string;
  cursor?: string;
  limit: number;
}

export const listShipments = async (db: PrismaClient, q: ListShipmentsQuery) => {
  const where: Prisma.ShipmentWhereInput = {
    merchantId: q.merchantId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.carrier ? { carrier: q.carrier } : {}),
  };
  const items = await db.shipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > q.limit;
  const data = hasMore ? items.slice(0, q.limit) : items;
  return { data, nextCursor: hasMore ? data[data.length - 1]!.id : null };
};
