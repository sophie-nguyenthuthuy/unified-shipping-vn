import { z } from "zod";

import { CarrierCode, ServiceLevel } from "./carrier.js";
import { Money } from "./money.js";

export const RateQuoteRequest = z.object({
  fromProvinceCode: z.string(),
  fromDistrictCode: z.string(),
  toProvinceCode: z.string(),
  toDistrictCode: z.string(),
  toWardCode: z.string().optional(),
  weightGrams: z.number().int().positive(),
  declaredValue: Money,
  cashOnDelivery: Money.optional(),
  serviceLevel: ServiceLevel.optional(),
});
export type RateQuoteRequest = z.infer<typeof RateQuoteRequest>;

export const RateQuote = z.object({
  carrier: CarrierCode,
  serviceLevel: ServiceLevel,
  serviceCode: z.string(),
  serviceName: z.string(),
  fee: Money,
  expectedDeliveryFrom: z.string().datetime().optional(),
  expectedDeliveryTo: z.string().datetime().optional(),
  insurance: Money.optional(),
  codFee: Money.optional(),
});
export type RateQuote = z.infer<typeof RateQuote>;
