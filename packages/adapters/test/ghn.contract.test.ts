import { createHmac } from "node:crypto";

import { GhnAdapter } from "../src/ghn/adapter.js";

import { runContractSuite } from "./contract.suite.js";

const SIGNING_SECRET = "ghn-test-secret";

const validBody = () =>
  Buffer.from(
    JSON.stringify({
      OrderCode: "TEST123",
      Status: "delivered",
      Time: "2026-05-14T10:00:00Z",
      ShopID: 1,
    }),
  );

runContractSuite({
  carrier: "ghn",
  buildAdapter: () =>
    new GhnAdapter({
      baseUrl: "http://localhost:0",
      credentials: { token: "test-token", shopId: 1 },
    }),
  signingSecret: SIGNING_SECRET,
  fixtures: {
    validWebhook: () => {
      const body = validBody();
      return {
        rawBody: body,
        headers: { "x-ghn-signature": createHmac("sha256", SIGNING_SECRET).update(body).digest("hex") },
      };
    },
    tamperedWebhook: () => ({
      rawBody: validBody(),
      headers: { "x-ghn-signature": "0".repeat(64) },
    }),
  },
});
