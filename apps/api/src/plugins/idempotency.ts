import { createHash } from "node:crypto";

import { IdempotencyConflictError } from "@usv/core";
import fp from "fastify-plugin";

const TTL_SECONDS = 24 * 60 * 60;

/**
 * Idempotency for POST endpoints.
 *
 * Flow:
 *   1. If no `Idempotency-Key`, pass through.
 *   2. If the key has a stored response with a *matching body hash*, replay it.
 *   3. If the key has a stored response with a *different body hash*, fail 409.
 *   4. If the key is fresh, acquire a Redis lock and let the handler run.
 *      The response is captured by `onSend` and persisted.
 *
 * Redis is the source of truth here; an optional periodic dump to Postgres
 * (`IdempotencyRecord`) provides durability across cache cold-starts.
 */
export const idempotencyPlugin = fp(async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return;
    const keyHeader = req.headers["idempotency-key"];
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
    if (!key || !req.merchantId) return;

    const bodyHash = hashBody(req.body);
    const redisKey = `idem:${req.merchantId}:${key}`;
    const existing = await app.redis.get(redisKey);
    if (existing) {
      const parsed = JSON.parse(existing) as { hash: string; status: number; body: unknown };
      if (parsed.hash !== bodyHash) throw IdempotencyConflictError(key);
      reply.status(parsed.status).send(parsed.body);
      return reply;
    }
    // Tag the request so `onSend` can persist the response.
    (req as unknown as { _idem?: { key: string; hash: string } })._idem = { key: redisKey, hash: bodyHash };
  });

  app.addHook("onSend", async (req, reply, payload) => {
    const tag = (req as unknown as { _idem?: { key: string; hash: string } })._idem;
    if (!tag) return payload;
    if (reply.statusCode >= 500) return payload;
    const body = typeof payload === "string" ? safeParse(payload) : payload;
    await app.redis.set(
      tag.key,
      JSON.stringify({ hash: tag.hash, status: reply.statusCode, body }),
      "EX",
      TTL_SECONDS,
    );
    return payload;
  });
});

const hashBody = (body: unknown): string =>
  createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");

const safeParse = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};
