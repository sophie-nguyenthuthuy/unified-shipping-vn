import { createHmac } from "node:crypto";

import { GhtkAdapter } from "../src/ghtk/adapter.js";

import { runContractSuite } from "./contract.suite.js";

const SIGNING_SECRET = "ghtk-test-secret";

const body = () => Buffer.from(JSON.stringify({ label_id: "S123.A456", status_id: 5 }));

runContractSuite({
  carrier: "ghtk",
  buildAdapter: () =>
    new GhtkAdapter({
      baseUrl: "http://localhost:0",
      credentials: { token: "test-token" },
    }),
  signingSecret: SIGNING_SECRET,
  fixtures: {
    validWebhook: () => {
      const b = body();
      return {
        rawBody: b,
        headers: { "x-ghtk-signature": createHmac("sha256", SIGNING_SECRET).update(b).digest("hex") },
      };
    },
    tamperedWebhook: () => ({ rawBody: body(), headers: { "x-ghtk-signature": "0".repeat(64) } }),
  },
});
