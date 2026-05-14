import fp from "fastify-plugin";

import { AuthenticationError } from "@usv/core";
import { findApiKeyBySecret } from "@usv/db";

/**
 * Bearer-token auth via API key.
 * Routes opt in by setting `config: { auth: 'required' }` (default) or
 * `auth: 'optional' | 'public'`.
 */

type AuthMode = "required" | "optional" | "public";

declare module "fastify" {
  interface FastifyContextConfig {
    auth?: AuthMode;
  }
}

export const authPlugin = fp(async (app) => {
  app.addHook("onRequest", async (req) => {
    req.merchantId = null;
    req.apiKeyId = null;
  });

  app.addHook("preHandler", async (req) => {
    const mode: AuthMode = req.routeOptions.config.auth ?? "required";
    if (mode === "public") return;

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      if (mode === "required") throw AuthenticationError("missing bearer token");
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    const key = await findApiKeyBySecret(app.db, token);
    if (!key) {
      if (mode === "required") throw AuthenticationError("invalid api key");
      return;
    }
    req.merchantId = key.merchantId;
    req.apiKeyId = key.id;
    void app.db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  });
});
