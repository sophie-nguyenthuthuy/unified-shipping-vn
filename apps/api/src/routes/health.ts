import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", { config: { auth: "public" } }, async () => ({ status: "ok" }));

  app.get("/readyz", { config: { auth: "public" } }, async (_req, reply) => {
    try {
      await app.db.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { status: "ready" };
    } catch (err: unknown) {
      reply.status(503);
      return { status: "not_ready", error: (err as Error).message };
    }
  });
};
