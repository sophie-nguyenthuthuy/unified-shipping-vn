import { randomBytes } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { newId, NotFoundError, ValidationError, WebhookEventType } from "@usv/core";

import { getSecretStore } from "../services/secret-store.js";

const CreateEndpointBody = z.object({
  url: z.string().url(),
  eventTypes: z.array(WebhookEventType).min(1),
});

export const webhookEndpointRoutes: FastifyPluginAsync = async (app) => {
  app.post("/webhook-endpoints", async (req, reply) => {
    const body = CreateEndpointBody.parse(req.body);
    const merchantId = req.merchantId!;
    if (!body.url.startsWith("https://") && process.env.NODE_ENV === "production") {
      throw ValidationError("webhook url must use https");
    }
    const secret = randomBytes(32).toString("base64url");
    const store = await getSecretStore();
    const secretEnc = await store.seal(secret);
    const id = newId("webhookEndpoint");
    await app.db.webhookEndpoint.create({
      data: {
        id,
        merchantId,
        url: body.url,
        eventTypes: body.eventTypes,
        secretEnc,
        kmsKeyId: process.env.USV_KMS_DEFAULT_KEY_ID ?? "unknown",
      },
    });
    reply.status(201);
    return {
      id,
      url: body.url,
      eventTypes: body.eventTypes,
      signingSecret: secret,
      reminder: "save this secret now; it will not be shown again",
    };
  });

  app.get("/webhook-endpoints", async (req) => {
    const merchantId = req.merchantId!;
    const items = await app.db.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, eventTypes: true, active: true, createdAt: true },
    });
    return { data: items };
  });

  app.delete("/webhook-endpoints/:id", async (req, reply) => {
    const merchantId = req.merchantId!;
    const { id } = req.params as { id: string };
    const found = await app.db.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!found) throw NotFoundError("webhook endpoint");
    await app.db.webhookEndpoint.update({ where: { id }, data: { active: false } });
    reply.status(204);
  });
};
