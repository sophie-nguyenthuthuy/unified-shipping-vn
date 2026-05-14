import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { CarrierCode, NotFoundError, newId } from "@usv/core";

import { getSecretStore } from "../services/secret-store.js";

const CreateAccountBody = z.object({
  carrier: CarrierCode,
  label: z.string().min(1).max(80),
  /** Carrier-specific credentials. Shape varies by carrier; sealed before storage. */
  credentials: z.record(z.unknown()),
  /** Non-secret metadata (shop ids, sender code, …). */
  config: z.record(z.unknown()).optional(),
});

/**
 * Manage per-merchant carrier accounts. Credentials are sealed via the
 * configured KMS provider before they touch the database; the plaintext is
 * never persisted and never returned.
 */
export const carrierAccountRoutes: FastifyPluginAsync = async (app) => {
  app.post("/carrier-accounts", async (req, reply) => {
    const body = CreateAccountBody.parse(req.body);
    const merchantId = req.merchantId!;
    const store = await getSecretStore();
    const encryptedSecret = await store.sealJson(body.credentials);

    const account = await app.db.carrierAccount.create({
      data: {
        id: newId("carrierAccount"),
        merchantId,
        carrier: body.carrier,
        label: body.label,
        active: true,
        encryptedSecret,
        // The KMS keyId is encoded in the envelope itself; we still capture
        // it on the row for at-a-glance dashboards and rotation queries.
        kmsKeyId: process.env.USV_KMS_DEFAULT_KEY_ID ?? "unknown",
        config: (body.config ?? {}) as never,
      },
    });

    reply.status(201);
    return {
      id: account.id,
      carrier: account.carrier,
      label: account.label,
      active: account.active,
      kmsKeyId: account.kmsKeyId,
      createdAt: account.createdAt.toISOString(),
    };
  });

  app.get("/carrier-accounts", async (req) => {
    const merchantId = req.merchantId!;
    const items = await app.db.carrierAccount.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, carrier: true, label: true, active: true, kmsKeyId: true, createdAt: true },
    });
    return { data: items };
  });

  app.delete("/carrier-accounts/:id", async (req, reply) => {
    const merchantId = req.merchantId!;
    const { id } = req.params as { id: string };
    const found = await app.db.carrierAccount.findFirst({ where: { id, merchantId } });
    if (!found) throw NotFoundError("carrier account");
    await app.db.carrierAccount.update({ where: { id }, data: { active: false } });
    reply.status(204);
  });
};
