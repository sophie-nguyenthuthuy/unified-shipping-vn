import { z } from "zod";

import { Money } from "./money.js";

export const ParcelItem = z.object({
  name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  weightGrams: z.number().int().positive(),
  declaredValue: Money,
  sku: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
});
export type ParcelItem = z.infer<typeof ParcelItem>;

export const Dimensions = z.object({
  lengthCm: z.number().int().positive().max(200),
  widthCm: z.number().int().positive().max(200),
  heightCm: z.number().int().positive().max(200),
});
export type Dimensions = z.infer<typeof Dimensions>;

export const Parcel = z.object({
  totalWeightGrams: z.number().int().positive(),
  dimensions: Dimensions,
  items: z.array(ParcelItem).min(1),
  declaredValue: Money,
  fragile: z.boolean().default(false),
  cashOnDelivery: Money.optional(),
});
export type Parcel = z.infer<typeof Parcel>;
