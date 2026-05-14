import { z } from "zod";

import { PhoneE164 } from "./phone.js";

/**
 * Addresses use Vietnam's 3-tier administrative hierarchy:
 *   province (tỉnh/thành) → district (quận/huyện) → ward (phường/xã)
 *
 * Each level carries both the human label and the GSO code; carriers use
 * different code systems, so the adapter layer maps GSO → carrier-specific IDs.
 */
export const AdminCode = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});
export type AdminCode = z.infer<typeof AdminCode>;

export const Address = z.object({
  name: z.string().min(1).max(120),
  phone: PhoneE164,
  email: z.string().email().optional(),
  street: z.string().min(1).max(255),
  ward: AdminCode,
  district: AdminCode,
  province: AdminCode,
  country: z.literal("VN").default("VN"),
  note: z.string().max(500).optional(),
});
export type Address = z.infer<typeof Address>;

export const formatAddress = (a: Address): string =>
  [a.street, a.ward.name, a.district.name, a.province.name].filter(Boolean).join(", ");
