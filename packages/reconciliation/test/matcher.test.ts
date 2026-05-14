import { describe, expect, it } from "vitest";

import { matchRemittance, type ExpectedEntry, type RemittanceLine } from "../src/matcher.js";

const exp = (overrides: Partial<ExpectedEntry>): ExpectedEntry => ({
  shipmentId: "shp_1",
  carrierTrackingCode: "TRK1",
  amountMinor: 100_000n,
  ...overrides,
});

const line = (overrides: Partial<RemittanceLine>): RemittanceLine => ({
  id: "rml_1",
  carrierTrackingCode: "TRK1",
  collectedMinor: 100_000n,
  feeMinor: 5_000n,
  netMinor: 95_000n,
  ...overrides,
});

describe("matchRemittance", () => {
  it("matches on tracking code and amount", () => {
    const result = matchRemittance([exp({})], [line({})]);
    expect(result).toEqual([{ kind: "matched", shipmentId: "shp_1", lineId: "rml_1" }]);
  });

  it("flags amount mismatches outside tolerance", () => {
    const result = matchRemittance([exp({})], [line({ collectedMinor: 99_000n })]);
    expect(result[0]).toMatchObject({ kind: "amount_mismatch", expectedMinor: 100_000n, actualMinor: 99_000n });
  });

  it("absorbs 1-VND rounding inside the default tolerance", () => {
    const result = matchRemittance([exp({})], [line({ collectedMinor: 100_001n })]);
    expect(result[0]?.kind).toBe("matched");
  });

  it("reports unmatched expected entries", () => {
    const result = matchRemittance([exp({})], []);
    expect(result).toEqual([
      { kind: "unmatched_expected", shipmentId: "shp_1", carrierTrackingCode: "TRK1" },
    ]);
  });

  it("reports unmatched lines (carrier sent money for a shipment we don't know about)", () => {
    const result = matchRemittance([], [line({ id: "rml_x", carrierTrackingCode: "TRK_X" })]);
    expect(result).toEqual([{ kind: "unmatched_line", lineId: "rml_x" }]);
  });

  it("detects duplicate remittance lines for the same shipment", () => {
    const result = matchRemittance(
      [exp({})],
      [line({ id: "rml_a" }), line({ id: "rml_b" })],
    );
    expect(result[0]).toMatchObject({ kind: "duplicate", lineIds: ["rml_a", "rml_b"] });
  });

  it("classifies a mixed batch deterministically", () => {
    const result = matchRemittance(
      [exp({ shipmentId: "shp_1", carrierTrackingCode: "A" }), exp({ shipmentId: "shp_2", carrierTrackingCode: "B" })],
      [line({ id: "rml_a", carrierTrackingCode: "A", collectedMinor: 100_000n })],
    );
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.kind === "matched")).toBe(true);
    expect(result.some((r) => r.kind === "unmatched_expected")).toBe(true);
  });
});
