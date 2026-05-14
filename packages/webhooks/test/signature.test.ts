import { describe, expect, it } from "vitest";

import { signOutboundWebhook, verifyOutboundWebhook } from "../src/signature.js";

describe("outbound webhook signatures", () => {
  const secret = "very-secret-merchant-key";
  const body = JSON.stringify({ hello: "world" });
  const now = 1_700_000_000;

  it("round-trips a freshly signed message", () => {
    const { signature, timestamp } = signOutboundWebhook(body, secret, now);
    const result = verifyOutboundWebhook({
      rawBody: body,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      secret,
      now: () => now,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const { signature, timestamp } = signOutboundWebhook(body, secret, now);
    const result = verifyOutboundWebhook({
      rawBody: body + "X",
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      secret,
      now: () => now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature_mismatch");
  });

  it("rejects expired timestamps", () => {
    const { signature, timestamp } = signOutboundWebhook(body, secret, now);
    const result = verifyOutboundWebhook({
      rawBody: body,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      secret,
      now: () => now + 10 * 60,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timestamp_outside_tolerance");
  });

  it("rejects missing signature headers", () => {
    const result = verifyOutboundWebhook({
      rawBody: body,
      signatureHeader: undefined,
      timestampHeader: String(now),
      secret,
      now: () => now,
    });
    expect(result.ok).toBe(false);
  });
});
