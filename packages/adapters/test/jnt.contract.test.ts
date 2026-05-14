import { createHash } from "node:crypto";

import { JntAdapter } from "../src/jnt/adapter.js";

import { runContractSuite } from "./contract.suite.js";

const SIGNING_SECRET = "jnt-test-secret";

const bodyText = JSON.stringify({ txlogisticId: "JNT001", scanType: "Delivered" });

runContractSuite({
  carrier: "jnt",
  buildAdapter: () =>
    new JntAdapter({
      baseUrl: "http://localhost:0",
      credentials: { apiAccount: "demo", privateKey: "demo-key" },
    }),
  signingSecret: SIGNING_SECRET,
  fixtures: {
    validWebhook: () => ({
      rawBody: Buffer.from(bodyText),
      headers: { digest: createHash("md5").update(bodyText + SIGNING_SECRET).digest("hex") },
    }),
    tamperedWebhook: () => ({
      rawBody: Buffer.from(bodyText),
      headers: { digest: "0".repeat(32) },
    }),
  },
});
