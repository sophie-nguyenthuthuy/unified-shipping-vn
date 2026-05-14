import { describe, expect, it } from "vitest";

import { isForwardTransition, isTerminal } from "../src/status.js";

describe("status transitions", () => {
  it("identifies terminal states", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("returned")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("lost")).toBe(true);
    expect(isTerminal("in_transit")).toBe(false);
  });

  it("rejects transitions out of terminal states", () => {
    expect(isForwardTransition("delivered", "in_transit")).toBe(false);
    expect(isForwardTransition("cancelled", "delivered")).toBe(false);
  });

  it("allows forward progression", () => {
    expect(isForwardTransition("pending", "picked_up")).toBe(true);
    expect(isForwardTransition("in_transit", "delivered")).toBe(true);
  });

  it("rejects out-of-order webhook noise", () => {
    expect(isForwardTransition("delivered", "out_for_delivery")).toBe(false);
    expect(isForwardTransition("in_transit", "pending")).toBe(false);
  });

  it("treats the same status as a no-op", () => {
    expect(isForwardTransition("in_transit", "in_transit")).toBe(true);
  });
});
