import { z } from "zod";

const VN_E164 = /^\+84(?:3|5|7|8|9)\d{8}$/;

/**
 * Accepts the common Vietnamese formats and normalises to E.164.
 *   "0901234567"      → "+84901234567"
 *   "84901234567"     → "+84901234567"
 *   "+84 901 234 567" → "+84901234567"
 */
export const normalizeVnPhone = (raw: string): string => {
  const digits = raw.replace(/[\s.\-()]/g, "");
  let n = digits;
  if (n.startsWith("+84")) n = n.slice(3);
  else if (n.startsWith("84")) n = n.slice(2);
  else if (n.startsWith("0")) n = n.slice(1);
  if (!/^[35789]\d{8}$/.test(n)) {
    throw new Error(`invalid Vietnamese phone: ${raw}`);
  }
  return `+84${n}`;
};

export const PhoneE164 = z.string().regex(VN_E164, "must be a Vietnamese phone in E.164");
export type PhoneE164 = z.infer<typeof PhoneE164>;
