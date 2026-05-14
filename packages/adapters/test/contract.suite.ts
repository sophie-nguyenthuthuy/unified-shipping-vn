import { describe, expect, it } from "vitest";

import type { CarrierAdapter } from "../src/common/contract.js";

/**
 * Behavioral contract every adapter must satisfy. Implementations import this
 * suite from their own test file and pass a factory that returns an adapter
 * wired against an MSW or testcontainers-backed fake.
 */
export interface ContractSuiteOptions {
  carrier: string;
  buildAdapter: () => CarrierAdapter | Promise<CarrierAdapter>;
  signingSecret: string;
  /** Helpers that construct payloads matching each carrier's webhook format. */
  fixtures: {
    validWebhook: () => { headers: Record<string, string>; rawBody: Buffer };
    tamperedWebhook: () => { headers: Record<string, string>; rawBody: Buffer };
  };
}

export const runContractSuite = (opts: ContractSuiteOptions): void => {
  describe(`${opts.carrier} adapter contract`, () => {
    it("rejects webhooks with a tampered signature", async () => {
      const adapter = await opts.buildAdapter();
      const fix = opts.fixtures.tamperedWebhook();
      await expect(
        adapter.parseWebhook({ headers: fix.headers, rawBody: fix.rawBody, signingSecret: opts.signingSecret }),
      ).rejects.toMatchObject({ code: "authentication_failed" });
    });

    it("emits the carrier code on the adapter instance", async () => {
      const adapter = await opts.buildAdapter();
      expect(adapter.carrier).toBe(opts.carrier);
    });

    it("normalizes a valid webhook (or surfaces 'not implemented') without crashing", async () => {
      const adapter = await opts.buildAdapter();
      const fix = opts.fixtures.validWebhook();
      try {
        const out = await adapter.parseWebhook({
          headers: fix.headers,
          rawBody: fix.rawBody,
          signingSecret: opts.signingSecret,
        });
        expect(out.externalId).toBeTruthy();
        expect(Array.isArray(out.events)).toBe(true);
      } catch (err: unknown) {
        // adapter scaffolds throw feature_disabled until mapping is filled in
        expect((err as { code?: string }).code).toBe("feature_disabled");
      }
    });
  });
};
