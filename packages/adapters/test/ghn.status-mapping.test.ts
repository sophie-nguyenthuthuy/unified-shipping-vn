import { describe, expect, it } from "vitest";

import { mapGhnStatus } from "../src/ghn/status-mapping.js";

describe("mapGhnStatus", () => {
  it.each([
    ["ready_to_pick", "ready_to_pickup"],
    ["picked", "picked_up"],
    ["delivering", "out_for_delivery"],
    ["delivered", "delivered"],
    ["return", "returning"],
    ["returned", "returned"],
    ["cancel", "cancelled"],
    ["lost", "lost"],
  ] as const)("maps %s → %s", (raw, normalized) => {
    expect(mapGhnStatus(raw)).toBe(normalized);
  });

  it("defaults unknown carrier codes to in_transit", () => {
    expect(mapGhnStatus("some_future_status_v3")).toBe("in_transit");
  });
});
