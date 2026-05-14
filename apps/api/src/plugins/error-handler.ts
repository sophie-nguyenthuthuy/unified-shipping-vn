import { UsvError } from "@usv/core";
import fp from "fastify-plugin";
import { ZodError } from "zod";

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof UsvError) {
      reply.status(err.httpStatus).send(err.toJSON());
      return;
    }
    if (err instanceof ZodError) {
      reply.status(422).send({
        error: {
          code: "validation_failed",
          message: "request validation failed",
          details: { issues: err.issues },
        },
      });
      return;
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      reply.status(429).send({ error: { code: "rate_limited", message: "rate limited" } });
      return;
    }

    req.log.error({ err, reqId: req.requestId }, "unhandled error");
    reply.status(500).send({ error: { code: "internal_error", message: "internal error" } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: "not_found", message: "route not found" } });
  });
});
