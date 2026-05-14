import { describe, expect, it } from "vitest";

import { addMoney, eqMoney, formatVnd, subMoney, vnd } from "../src/money.js";

describe("money", () => {
  it("constructs VND from non-negative integers only", () => {
    expect(vnd(0)).toEqual({ amount: 0, currency: "VND" });
    expect(() => vnd(-1)).toThrow();
    expect(() => vnd(1.5)).toThrow();
  });

  it("adds and subtracts within the same currency", () => {
    expect(addMoney(vnd(1000), vnd(500))).toEqual(vnd(1500));
    expect(subMoney(vnd(1000), vnd(300))).toEqual(vnd(700));
  });

  it("rejects mixed currency math", () => {
    const wrong = { amount: 1, currency: "USD" as unknown as "VND" };
    expect(() => addMoney(vnd(1), wrong)).toThrow(/currency mismatch/);
  });

  it("formats VND with vi-VN grouping and a non-breaking space", () => {
    expect(formatVnd(vnd(1_234_567))).toBe("1.234.567 ₫");
  });

  it("equals only when both fields match", () => {
    expect(eqMoney(vnd(100), vnd(100))).toBe(true);
    expect(eqMoney(vnd(100), vnd(101))).toBe(false);
  });
});
