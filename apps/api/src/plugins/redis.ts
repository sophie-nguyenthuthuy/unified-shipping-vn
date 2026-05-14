import fp from "fastify-plugin";
import { Redis } from "ioredis";

export interface RedisPluginOptions {
  url: string;
}

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp<RedisPluginOptions>(async (app, opts) => {
  const client = new Redis(opts.url, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err: Error) => app.log.error({ err }, "redis error"));

  app.decorate("redis", client);
  app.addHook("onClose", async () => {
    await client.quit().catch(() => undefined);
  });
});
