import { randomUUID } from "node:crypto";

import fp from "fastify-plugin";

export const requestIdPlugin = fp(async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && incoming.length <= 64 ? incoming : randomUUID();
    req.requestId = id;
    reply.header("x-request-id", id);
  });
});
