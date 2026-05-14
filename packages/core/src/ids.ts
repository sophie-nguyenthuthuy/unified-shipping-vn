import { randomBytes } from "node:crypto";

import { z } from "zod";

const PREFIXES = {
  shipment: "shp",
  merchant: "mch",
  apiKey: "key",
  webhookEvent: "evt",
  webhookEndpoint: "whe",
  webhookDelivery: "whd",
  remittance: "rmt",
  remittanceLine: "rml",
  reconciliationDispute: "dsp",
  codEntry: "cod",
  carrierAccount: "car",
  user: "usr",
} as const;

export type IdKind = keyof typeof PREFIXES;

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32

const randomB32 = (len: number): string => {
  const bytes = randomBytes(len);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
};

export const newId = (kind: IdKind): string => `${PREFIXES[kind]}_${randomB32(22)}`;

export const idSchema = (kind: IdKind) =>
  z.string().regex(new RegExp(`^${PREFIXES[kind]}_[${ALPHABET}]{22}$`));
