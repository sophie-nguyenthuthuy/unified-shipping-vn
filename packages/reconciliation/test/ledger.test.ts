import { describe, expect, it } from "vitest";

import { codBalance } from "../src/ledger.js";

describe("codBalance", () => {
  it("returns zero for a fully settled shipment", () => {
    const balance = codBalance([
      { kind: "expected", amountMinor: 100_000n },
      { kind: "collected", amountMinor: 100_000n },
      { kind: "remitted", amountMinor: 0n },
    ]);
    expect(balance).toBe(0n);
  });

  it("returns positive when carrier still owes us", () => {
    const balance = codBalance([{ kind: "expected", amountMinor: 100_000n }]);
    expect(balance).toBe(100_000n);
  });

  it("incorporates adjustments", () => {
    const balance = codBalance([
      { kind: "expected", amountMinor: 100_000n },
      { kind: "collected", amountMinor: 50_000n },
      { kind: "remitted", amountMinor: 40_000n },
      { kind: "adjusted", amountMinor: 10_000n },
    ]);
    expect(balance).toBe(20_000n);
  });
});
