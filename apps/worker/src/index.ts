import { loadEnv } from "@usv/config";
import { createLogger, startTelemetry } from "@usv/observability";

import { startQueues } from "./queues.js";
import { startReconciliationCron } from "./jobs/reconciliation-cron.js";
import { startWebhookDeliveryWorker } from "./processors/webhook-delivery.js";
import { startInboundFanoutWorker } from "./processors/inbound-fanout.js";

const log = createLogger("usv-worker");

const main = async () => {
  const env = loadEnv();
  await startTelemetry("usv-worker");

  const queues = startQueues(env.REDIS_URL);
  const deliveryWorker = startWebhookDeliveryWorker({ redisUrl: env.REDIS_URL });
  const fanoutWorker = startInboundFanoutWorker({ redisUrl: env.REDIS_URL, queues });
  const reconciliationCron = startReconciliationCron({ queues });

  const shutdown = async () => {
    log.info("shutting down workers");
    await Promise.allSettled([deliveryWorker.close(), fanoutWorker.close(), reconciliationCron.close()]);
    await Promise.allSettled([queues.webhookDelivery.close(), queues.reconciliation.close()]);
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  log.info({ env: env.NODE_ENV }, "worker started");
};

main().catch((err: unknown) => {
  log.error({ err }, "worker failed to start");
  process.exit(1);
});
