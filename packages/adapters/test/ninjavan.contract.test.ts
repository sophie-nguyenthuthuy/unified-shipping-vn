import { createHmac } from "node:crypto";

import { NinjaVanAdapter } from "../src/ninjavan/adapter.js";

import { runContractSuite } from "./contract.suite.js";

const SIGNING_SECRET = "ninjavan-test-secret";
const body = () => Buffer.from(JSON.stringify({ tracking_id: "NV123", status: "Successful Delivery" }));

runContractSuite({
  carrier: "ninjavan",
  buildAdapter: () =>
    new NinjaVanAdapter({
      baseUrl: "http://localhost:0",
      credentials: { clientId: "demo", clientSecret: "demo", country: "vn" },
    }),
  signingSecret: SIGNING_SECRET,
  fixtures: {
    validWebhook: () => {
      const b = body();
      return {
        rawBody: b,
        headers: { "x-ninjavan-hmac-sha256": createHmac("sha256", SIGNING_SECRET).update(b).digest("base64") },
      };
    },
    tamperedWebhook: () => ({ rawBody: body(), headers: { "x-ninjavan-hmac-sha256": "AAAAAAAAAAAAAAAAAAAAAA==" } }),
  },
});
