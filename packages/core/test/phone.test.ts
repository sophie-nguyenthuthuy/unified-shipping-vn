import { describe, expect, it } from "vitest";

import { normalizeVnPhone } from "../src/phone.js";

describe("normalizeVnPhone", () => {
  it.each([
    ["0901234567", "+84901234567"],
    ["84901234567", "+84901234567"],
    ["+84901234567", "+84901234567"],
    ["+84 901 234 567", "+84901234567"],
    ["090.123.4567", "+84901234567"],
    ["(090) 123-4567", "+84901234567"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizeVnPhone(input)).toBe(expected);
  });

  it.each(["0123456789", "12345", "abcdefghij", "+1234567890"])("rejects %s", (input) => {
    expect(() => normalizeVnPhone(input)).toThrow();
  });
});
