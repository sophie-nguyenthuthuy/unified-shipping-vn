import { createHash } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

import { CarrierCode, NotFoundError, ValidationError } from "@usv/core";

import { resolveAdapter } from "../services/adapter-resolver.js";
import { getSecretStore } from "../services/secret-store.js";

/**
 * Inbound carrier webhooks. These are *unauthenticated* in the API-key sense;
 * authentication is the carrier signature, verified inside the adapter.
 *
 * We persist every inbound payload (idempotent on payloadHash) so disputes
 * can be reconstructed from carrier-side records months later.
 */
export const inboundWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    ["application/json", "application/json; charset=utf-8"],
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post(
    "/webhooks/inbound/:carrier",
    { config: { auth: "public" } },
    async (req, reply) => {
      const { carrier } = req.params as { carrier: string };
      const carrierCode = CarrierCode.parse(carrier);
      const raw = req.body as Buffer;
      if (!Buffer.isBuffer(raw) || raw.length === 0) throw ValidationError("empty body");

      const payloadHash = createHash("sha256").update(raw).digest("hex");
      const existing = await app.db.inboundWebhook.findUnique({
        where: { carrier_payloadHash: { carrier: carrierCode, payloadHash } as never },
      });
      if (existing) {
        reply.status(200);
        return { status: "duplicate", id: existing.id };
      }

      // Carrier credentials are looked up by inferring merchant from payload;
      // for now we require a `?merchant=<id>` query so the prototype is honest
      // about what production needs (a carrier-specific routing table).
      const merchantId = (req.query as { merchant?: string }).merchant;
      if (!merchantId) throw ValidationError("merchant resolution not configured");
      const account = await app.db.carrierAccount.findFirst({ where: { merchantId, carrier: carrierCode, active: true } });
      if (!account) throw NotFoundError("carrier account");

      const adapter = await resolveAdapter(app, account);

      // The carrier-side signing secret is stored as part of the same sealed
      // credentials JSON that the adapter consumes (e.g. `{ token, webhookSecret }`).
      // We decrypt once, then pull the field by name so adapters stay
      // unaware of the storage scheme.
      const store = await getSecretStore();
      const creds = await store.openJson<Record<string, unknown>>(account.encryptedSecret);
      const signingSecret =
        (typeof creds.webhookSecret === "string" && creds.webhookSecret) ||
        (typeof creds.signingSecret === "string" && creds.signingSecret) ||
        "";
      if (!signingSecret) {
        throw ValidationError(
          `carrier account ${account.id} has no webhookSecret in credentials`,
        );
      }

      const result = await adapter.parseWebhook({
        headers: req.headers as Record<string, string | string[] | undefined>,
        rawBody: raw,
        signingSecret,
      });

      const inbound = await app.db.inboundWebhook.create({
        data: { id: result.externalId, carrier: carrierCode, payloadHash, payload: JSON.parse(raw.toString("utf8")) },
      });

      // Enqueue normalised events for delivery to merchant endpoints (worker).
      for (const event of result.events) {
        await app.redis.xadd(
          "usv:inbound-events",
          "*",
          "merchantId",
          merchantId,
          "type",
          event.type,
          "payload",
          JSON.stringify(event),
        );
      }

      reply.status(202);
      return { status: "accepted", id: inbound.id, events: result.events.length };
    },
  );
};
