import type { PrismaClient } from "@prisma/client";

const TTL_MS = 24 * 60 * 60 * 1000;

export interface StoreIdempotencyInput {
  merchantId: string;
  key: string;
  requestHash: string;
  responseCode: number;
  responseBody: unknown;
}

const compoundKey = (merchantId: string, key: string) => `${merchantId}:${key}`;

export const findIdempotencyRecord = (db: PrismaClient, merchantId: string, key: string) =>
  db.idempotencyRecord.findUnique({ where: { id: compoundKey(merchantId, key) } });

export const storeIdempotencyRecord = (db: PrismaClient, input: StoreIdempotencyInput) =>
  db.idempotencyRecord.create({
    data: {
      id: compoundKey(input.merchantId, input.key),
      requestHash: input.requestHash,
      responseCode: input.responseCode,
      responseBody: input.responseBody as never,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

export const pruneExpiredIdempotency = (db: PrismaClient) =>
  db.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } });
