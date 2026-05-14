import type { Prisma, PrismaClient } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

/**
 * Wraps a unit of work in a Postgres transaction with sensible defaults.
 * `Serializable` is appropriate for ledger writes; override for reads.
 */
export const withTx = <T>(
  db: PrismaClient,
  fn: (tx: TxClient) => Promise<T>,
  isolationLevel: Prisma.TransactionIsolationLevel = "Serializable",
): Promise<T> =>
  db.$transaction(fn, {
    isolationLevel,
    maxWait: 5_000,
    timeout: 15_000,
  });
