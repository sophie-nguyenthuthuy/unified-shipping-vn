import type { FastifyPluginAsync } from "fastify";

import { RateQuoteRequest } from "@usv/core";

import { resolveAdapter } from "../services/adapter-resolver.js";

export const rateRoutes: FastifyPluginAsync = async (app) => {
  app.post("/rates/quote", async (req) => {
    const body = RateQuoteRequest.parse(req.body);
    const merchantId = req.merchantId!;
    const accounts = await app.db.carrierAccount.findMany({ where: { merchantId, active: true } });
    const settled = await Promise.allSettled(
      accounts.map(async (acct) => {
        const adapter = await resolveAdapter(app, acct);
        return adapter.quote(body);
      }),
    );
    const quotes = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    quotes.sort((a, b) => a.fee.amount - b.fee.amount);
    return { data: quotes };
  });
};
