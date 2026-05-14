import { Queue } from "bullmq";

export interface WebhookDeliveryJob {
  deliveryId: string;
  attempt: number;
}

export interface ReconciliationJob {
  merchantId: string;
  carrier: string;
  /** ISO date for the period start (inclusive). */
  from: string;
  to: string;
}

export interface QueueSet {
  webhookDelivery: Queue<WebhookDeliveryJob>;
  reconciliation: Queue<ReconciliationJob>;
}

const connection = (url: string) => ({ url });

export const startQueues = (redisUrl: string): QueueSet => ({
  webhookDelivery: new Queue<WebhookDeliveryJob>("webhook-delivery", {
    connection: connection(redisUrl),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  }),
  reconciliation: new Queue<ReconciliationJob>("reconciliation", {
    connection: connection(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 1_000 },
      removeOnFail: false,
    },
  }),
});
