import { z } from "zod";

/**
 * Money is stored as integer minor units to avoid float drift.
 * VND has no minor unit in practice; we still use integer dong.
 */
export const Currency = z.enum(["VND"]);
export type Currency = z.infer<typeof Currency>;

export const Money = z.object({
  amount: z.number().int().nonnegative(),
  currency: Currency,
});
export type Money = z.infer<typeof Money>;

export const vnd = (amount: number): Money => {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`vnd(${amount}): expected non-negative integer`);
  }
  return { amount, currency: "VND" };
};

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new TypeError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new TypeError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: a.amount - b.amount, currency: a.currency };
};

export const eqMoney = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.amount === b.amount;

export const formatVnd = (m: Money): string => {
  if (m.currency !== "VND") throw new TypeError(`formatVnd: ${m.currency}`);
  return `${m.amount.toLocaleString("vi-VN")} ₫`;
};
