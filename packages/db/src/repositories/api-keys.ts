import { randomBytes } from "node:crypto";

import argon2 from "argon2";
import type { PrismaClient } from "@prisma/client";

import { newId } from "@usv/core";

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const PEPPER = () => {
  const p = process.env.API_KEY_PEPPER;
  if (!p || p.length < 32) throw new Error("API_KEY_PEPPER missing or too short (>= 32 chars)");
  return p;
};

export const generateApiKeySecret = (): { secret: string; prefix: string } => {
  const raw = randomBytes(32).toString("base64url");
  const secret = `usv_live_${raw}`;
  return { secret, prefix: secret.slice(0, 8) };
};

export const hashApiKey = (secret: string): Promise<string> =>
  argon2.hash(`${secret}${PEPPER()}`, ARGON2_OPTS);

export const verifyApiKey = (hash: string, secret: string): Promise<boolean> =>
  argon2.verify(hash, `${secret}${PEPPER()}`);

export interface CreateApiKeyInput {
  merchantId: string;
  label: string;
  scopes?: string[];
  expiresAt?: Date;
}

export const createApiKey = async (
  db: PrismaClient,
  input: CreateApiKeyInput,
): Promise<{ id: string; secret: string; prefix: string }> => {
  const { secret, prefix } = generateApiKeySecret();
  const hash = await hashApiKey(secret);
  const id = newId("apiKey");
  await db.apiKey.create({
    data: {
      id,
      merchantId: input.merchantId,
      hash,
      prefix,
      label: input.label,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ?? null,
    },
  });
  return { id, secret, prefix };
};

export const revokeApiKey = (db: PrismaClient, id: string) =>
  db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });

/**
 * Look up an API key by secret. We can't index on the hash directly because
 * argon2 hashes are not deterministic; we narrow by prefix and verify the
 * candidate hashes in memory. Plan limits keep the candidate set tiny.
 */
export const findApiKeyBySecret = async (db: PrismaClient, secret: string) => {
  if (secret.length < 12) return null;
  const prefix = secret.slice(0, 8);
  const candidates = await db.apiKey.findMany({
    where: { prefix, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    take: 16,
  });
  for (const c of candidates) {
    if (await verifyApiKey(c.hash, secret)) return c;
  }
  return null;
};
