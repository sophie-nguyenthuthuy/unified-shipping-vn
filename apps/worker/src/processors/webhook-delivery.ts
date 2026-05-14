import { Worker, type Job } from "bullmq";

import { createSecretStore, resolveProviderFromEnv, type SecretStore } from "@usv/crypto";
import { getDb } from "@usv/db";
import { createLogger, webhookDeliveriesTotal } from "@usv/observability";
import { MAX_ATTEMPTS, deliverWebhook, nextRetryDelaySeconds } from "@usv/webhooks";

import type { WebhookDeliveryJob } from "../queues.js";

const log = createLogger("worker.webhook-delivery");

export interface WebhookDeliveryWorkerOptions {
  redisUrl: string;
}

let _store: Promise<SecretStore> | null = null;
const secretStore = (): Promise<SecretStore> => {
  if (!_store) {
    _store = (async () => {
      const provider = await resolveProviderFromEnv();
      const defaultKeyId = process.env.USV_KMS_DEFAULT_KEY_ID;
      if (!defaultKeyId) throw new Error("USV_KMS_DEFAULT_KEY_ID required");
      return createSecretStore(provider, { defaultKeyId });
    })();
  }
  return _store;
};

export const startWebhookDeliveryWorker = (opts: WebhookDeliveryWorkerOptions) => {
  const db = getDb();
  return new Worker<WebhookDeliveryJob>(
    "webhook-delivery",
    async (job: Job<WebhookDeliveryJob>) => {
      const delivery = await db.webhookDelivery.findUnique({
        where: { id: job.data.deliveryId },
        include: { event: true, endpoint: true },
      });
      if (!delivery || !delivery.endpoint.active) return;

      const store = await secretStore();
      const secret = (await store.open(delivery.endpoint.secretEnc)).toString("utf8");

      const result = await deliverWebhook({
        endpointUrl: delivery.endpoint.url,
        event: {
          id: delivery.event.id,
          type: delivery.event.type as never,
          occurredAt: delivery.event.occurredAt.toISOString(),
          merchantId: delivery.event.merchantId,
          data: delivery.event.data,
        },
        secret,
        attempt: delivery.attempt,
      });

      webhookDeliveriesTotal().add(1, { outcome: result.ok ? "delivered" : "failed" });

      if (result.ok) {
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "delivered",
            responseCode: result.statusCode,
            responseBody: result.responseBodySnippet,
            deliveredAt: new Date(),
          },
        });
        return;
      }

      const nextAttempt = delivery.attempt + 1;
      const nextSec = result.retryable ? nextRetryDelaySeconds(nextAttempt) : null;
      if (!nextSec || nextAttempt > MAX_ATTEMPTS) {
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "dead_lettered",
            responseCode: result.statusCode,
            responseBody: result.responseBodySnippet,
            error: result.errorMessage,
          },
        });
        log.warn({ deliveryId: delivery.id }, "delivery dead-lettered");
        return;
      }

      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "pending",
          attempt: nextAttempt,
          responseCode: result.statusCode,
          responseBody: result.responseBodySnippet,
          error: result.errorMessage,
          nextAttemptAt: new Date(Date.now() + nextSec * 1000),
        },
      });
      await job.queue.add(
        "deliver",
        { deliveryId: delivery.id, attempt: nextAttempt },
        { delay: nextSec * 1000 },
      );
    },
    { connection: { url: opts.redisUrl }, concurrency: 20 },
  );
};
