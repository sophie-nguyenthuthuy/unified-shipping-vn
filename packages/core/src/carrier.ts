import { z } from "zod";

export const CarrierCode = z.enum(["ghn", "ghtk", "jnt", "viettelpost", "ninjavan"]);
export type CarrierCode = z.infer<typeof CarrierCode>;

export const CARRIER_DISPLAY_NAMES: Record<CarrierCode, string> = {
  ghn: "Giao Hàng Nhanh",
  ghtk: "Giao Hàng Tiết Kiệm",
  jnt: "J&T Express",
  viettelpost: "Viettel Post",
  ninjavan: "Ninja Van",
};

export const ServiceLevel = z.enum(["standard", "express", "economy", "same_day"]);
export type ServiceLevel = z.infer<typeof ServiceLevel>;
