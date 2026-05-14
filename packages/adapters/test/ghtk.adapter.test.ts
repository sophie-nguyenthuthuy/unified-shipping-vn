import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { GhtkAdapter } from "../src/ghtk/adapter.js";
import { mapGhtkStatus } from "../src/ghtk/status-mapping.js";
import { ghtkRemittanceLinesToRaw } from "../src/ghtk/remittance-import.js";

const SIGNING_SECRET = "test-secret";

const build = () =>
  new GhtkAdapter({ baseUrl: "http://localhost:0", credentials: { token: "test-token" } });

describe("ghtk status mapping", () => {
  it.each([
    [-1, "cancelled"],
    [1, "pending"],
    [2, "ready_to_pickup"],
    [12, "ready_to_pickup"],
    [13, "picked_up"],
    [4, "out_for_delivery"],
    [5, "delivered"],
    [6, "delivered"],
    [9, "delivery_failed"],
    [20, "returning"],
    [21, "returned"],
  ] as const)("maps %s → %s", (raw, normalized) => {
    expect(mapGhtkStatus(raw)).toBe(normalized);
  });

  it("accepts numeric strings (carrier sometimes sends quoted ints)", () => {
    expect(mapGhtkStatus("5")).toBe("delivered");
  });

  it("falls back to in_transit for unknown codes (forward-compat)", () => {
    expect(mapGhtkStatus(9999)).toBe("in_transit");
    expect(mapGhtkStatus("nonsense")).toBe("in_transit");
  });
});

describe("ghtk webhook parsing", () => {
  const validBody = (overrides: Record<string, unknown> = {}) =>
    Buffer.from(
      JSON.stringify({
        label_id: "S12345.A6789",
        partner_id: "ORDER-1",
        status_id: 5,
        action_time: "2026-05-14 10:30:00",
        ...overrides,
      }),
    );

  const sign = (body: Buffer) => createHmac("sha256", SIGNING_SECRET).update(body).digest("hex");

  it("verifies the signature and normalizes a delivered event", async () => {
    const adapter = build();
    const body = validBody();
    const result = await adapter.parseWebhook({
      headers: { "x-secure-key": sign(body) },
      rawBody: body,
      signingSecret: SIGNING_SECRET,
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("shipment.delivered");
    expect((result.events[0]?.data as { status: string }).status).toBe("delivered");
    expect((result.events[0]?.data as { merchantOrderId: string }).merchantOrderId).toBe("ORDER-1");
    expect(result.externalId).toContain("S12345.A6789");
  });

  it("emits status_changed for non-delivered statuses", async () => {
    const adapter = build();
    const body = validBody({ status_id: 4 });
    const result = await adapter.parseWebhook({
      headers: { "x-secure-key": sign(body) },
      rawBody: body,
      signingSecret: SIGNING_SECRET,
    });
    expect(result.events[0]?.type).toBe("shipment.status_changed");
  });

  it("accepts the legacy x-ghtk-signature header alias", async () => {
    const adapter = build();
    const body = validBody();
    const result = await adapter.parseWebhook({
      headers: { "x-ghtk-signature": sign(body) },
      rawBody: body,
      signingSecret: SIGNING_SECRET,
    });
    expect(result.events).toHaveLength(1);
  });

  it("rejects tampered bodies", async () => {
    const adapter = build();
    const body = validBody();
    const tampered = Buffer.concat([body, Buffer.from("X")]);
    await expect(
      adapter.parseWebhook({
        headers: { "x-secure-key": sign(body) },
        rawBody: tampered,
        signingSecret: SIGNING_SECRET,
      }),
    ).rejects.toMatchObject({ code: "authentication_failed" });
  });

  it("rejects mismatched-length signatures without leaking timing info", async () => {
    const adapter = build();
    const body = validBody();
    await expect(
      adapter.parseWebhook({
        headers: { "x-secure-key": "deadbeef" },
        rawBody: body,
        signingSecret: SIGNING_SECRET,
      }),
    ).rejects.toMatchObject({ code: "authentication_failed" });
  });

  it("converts +07:00 timestamps to ISO UTC", async () => {
    const adapter = build();
    const body = validBody({ action_time: "2026-05-14 10:30:00" });
    const result = await adapter.parseWebhook({
      headers: { "x-secure-key": sign(body) },
      rawBody: body,
      signingSecret: SIGNING_SECRET,
    });
    expect(result.events[0]?.occurredAt).toBe("2026-05-14T03:30:00.000Z");
  });
});

describe("ghtk remittance import", () => {
  it("normalises lines and computes net when carrier provides it", () => {
    const out = ghtkRemittanceLinesToRaw([
      {
        label_id: "S1.A1",
        pick_money: 200_000,
        fee: 25_000,
        insurance_fee: 1_000,
        total_collect: 174_000,
        delivered_date: "2026-05-10T08:00:00Z",
        paid_date: "2026-05-12T09:00:00Z",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.collectedAmount.amount).toBe(200_000);
    expect(out[0]?.feeAmount.amount).toBe(26_000);
    expect(out[0]?.netAmount.amount).toBe(174_000);
    expect(out[0]?.remittedAt).toBe("2026-05-12T09:00:00.000Z");
  });

  it("computes net itself when total_collect is missing", () => {
    const out = ghtkRemittanceLinesToRaw([
      {
        label_id: "S1.A2",
        pick_money: 100_000,
        fee: 20_000,
        // omit total_collect — fall back to computed net
        total_collect: undefined as unknown as number,
      },
    ]);
    expect(out[0]?.netAmount.amount).toBe(80_000);
  });

  it("clamps net to >= 0 even if the carrier sends a negative", () => {
    const out = ghtkRemittanceLinesToRaw([
      {
        label_id: "S1.A3",
        pick_money: 0,
        fee: 25_000,
        total_collect: -25_000,
      },
    ]);
    expect(out[0]?.netAmount.amount).toBe(0);
  });
});
