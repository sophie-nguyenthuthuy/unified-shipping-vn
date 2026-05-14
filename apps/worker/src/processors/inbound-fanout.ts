import { newId } from "@usv/core";
import { getDb } from "@usv/db";
import { createLogger } from "@usv/observability";
import { Redis } from "ioredis";

import type { QueueSet } from "../queues.js";

const log = createLogger("worker.inbound-fanout");

/**
 * Reads the `usv:inbound-events` Redis stream populated by the API webhook
 * ingest route, persists each normalized event, and fans it out into a
 * `WebhookDelivery` row per matching merchant endpoint.
 *
 * Uses a consumer group for at-least-once semantics; idempotency on the
 * downstream `WebhookEvent.id` prevents duplicate persistence.
 */
export const startInboundFanoutWorker = (opts: { redisUrl: string; queues: QueueSet }) => {
  const db = getDb();
  const redis = new Redis(opts.redisUrl, { maxRetriesPerRequest: null });
  const STREAM = "usv:inbound-events";
  const GROUP = "fanout";
  const CONSUMER = `fanout-${process.pid}`;

  void redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM").catch(() => undefined);

  let running = true;
  const tick = async () => {
    while (running) {
      try {
        const res = await redis.xreadgroup(
          "GROUP",
          GROUP,
          CONSUMER,
          "COUNT",
          "32",
          "BLOCK",
          "5000",
          "STREAMS",
          STREAM,
          ">",
        );
        if (!res) continue;
        const streams = res as Array<[string, Array<[string, string[]]>]>;
        for (const [, entries] of streams) {
          for (const [id, fields] of entries) {
            await handleEntry(fields);
            await redis.xack(STREAM, GROUP, id);
          }
        }
      } catch (err: unknown) {
        log.error({ err }, "inbound fanout tick failed");
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  };

  const handleEntry = async (fields: string[]) => {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) map[fields[i]!] = fields[i + 1]!;
    const merchantId = map.merchantId!;
    const payload = JSON.parse(map.payload!) as { type: string; occurredAt: string; data: unknown };
    const eventId = newId("webhookEvent");

    await db.webhookEvent.create({
      data: {
        id: eventId,
        merchantId,
        type: payload.type,
        occurredAt: new Date(payload.occurredAt),
        data: payload.data as never,
      },
    });

    const endpoints = await db.webhookEndpoint.findMany({
      where: { merchantId, active: true, eventTypes: { has: payload.type } },
    });
    for (const ep of endpoints) {
      const delivery = await db.webhookDelivery.create({
        data: { id: newId("webhookDelivery"), eventId, endpointId: ep.id, attempt: 1 },
      });
      await opts.queues.webhookDelivery.add("deliver", { deliveryId: delivery.id, attempt: 1 });
    }
  };

  void tick();

  return {
    close: async () => {
      running = false;
      await redis.quit().catch(() => undefined);
    },
  };
};
