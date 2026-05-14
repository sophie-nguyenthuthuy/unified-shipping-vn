import { ViettelPostAdapter } from "../src/viettelpost/adapter.js";

import { runContractSuite } from "./contract.suite.js";

const SIGNING_SECRET = "vtp-test-secret";
const body = () => Buffer.from(JSON.stringify({ ORDER_NUMBER: "VTP123", ORDER_STATUS: 503 }));

runContractSuite({
  carrier: "viettelpost",
  buildAdapter: () =>
    new ViettelPostAdapter({
      baseUrl: "http://localhost:0",
      credentials: { username: "demo", password: "demo" },
    }),
  signingSecret: SIGNING_SECRET,
  fixtures: {
    validWebhook: () => ({ rawBody: body(), headers: { "x-vtp-signature": "demo" } }),
    tamperedWebhook: () => ({ rawBody: body(), headers: {} }),
  },
});
