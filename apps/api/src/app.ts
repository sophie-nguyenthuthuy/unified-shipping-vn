import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";

import type { Env } from "@usv/config";
import { getDb } from "@usv/db";
import { createLogger } from "@usv/observability";

import { authPlugin } from "./plugins/auth.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { idempotencyPlugin } from "./plugins/idempotency.js";
import { redisPlugin } from "./plugins/redis.js";
import { requestIdPlugin } from "./plugins/request-id.js";
import { carrierAccountRoutes } from "./routes/carrier-accounts.js";
import { healthRoutes } from "./routes/health.js";
import { rateRoutes } from "./routes/rates.js";
import { reconciliationRoutes } from "./routes/reconciliation.js";
import { shipmentRoutes } from "./routes/shipments.js";
import { webhookEndpointRoutes } from "./routes/webhook-endpoints.js";
import { inboundWebhookRoutes } from "./routes/webhooks-inbound.js";

export interface BuildServerOptions {
  env: Env;
}

export const buildServer = async ({ env }: BuildServerOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: createLogger("usv-api", env.LOG_LEVEL),
    disableRequestLogging: false,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(requestIdPlugin);
  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: [env.DASHBOARD_PUBLIC_URL], credentials: true });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Unified Shipping VN API",
        version: "0.1.0",
        description: "One API for Vietnamese carriers with COD reconciliation.",
      },
      servers: [{ url: env.API_PUBLIC_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "usv_live_…" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(redisPlugin, { url: env.REDIS_URL });
  await app.register(rateLimit, {
    global: false,
    redis: app.redis,
    max: env.RATE_LIMIT_DEFAULT_RPM,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.merchantId ?? req.ip,
  });

  app.decorate("db", getDb());

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(idempotencyPlugin);

  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(rateRoutes, { prefix: "/v1" });
  await app.register(shipmentRoutes, { prefix: "/v1" });
  await app.register(carrierAccountRoutes, { prefix: "/v1" });
  await app.register(webhookEndpointRoutes, { prefix: "/v1" });
  await app.register(reconciliationRoutes, { prefix: "/v1" });
  await app.register(inboundWebhookRoutes, { prefix: "/v1" });

  return app;
};

declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof getDb>;
  }
  interface FastifyRequest {
    merchantId: string | null;
    apiKeyId: string | null;
    requestId: string;
  }
}
