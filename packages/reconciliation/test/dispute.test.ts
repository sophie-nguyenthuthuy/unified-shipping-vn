import { describe, expect, it } from "vitest";

import { canTransition, isTerminalDispute } from "../src/dispute.js";

describe("dispute state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("open", "carrier_contacted")).toBe(true);
    expect(canTransition("carrier_contacted", "awaiting_response")).toBe(true);
    expect(canTransition("awaiting_response", "resolved")).toBe(true);
  });

  it("locks terminal states", () => {
    expect(canTransition("resolved", "open")).toBe(false);
    expect(canTransition("written_off", "carrier_contacted")).toBe(false);
    expect(isTerminalDispute("resolved")).toBe(true);
    expect(isTerminalDispute("written_off")).toBe(true);
  });

  it("allows direct write-off from any pre-terminal state", () => {
    expect(canTransition("open", "written_off")).toBe(true);
    expect(canTransition("carrier_contacted", "written_off")).toBe(true);
    expect(canTransition("awaiting_response", "written_off")).toBe(true);
  });
});
