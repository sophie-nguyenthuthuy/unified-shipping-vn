import { PrismaClient } from "@prisma/client";

import { createApiKey } from "./repositories/api-keys.js";
import { createMerchant } from "./repositories/merchants.js";

const db = new PrismaClient();

const seed = async () => {
  const existing = await db.merchant.findFirst({ where: { email: "demo@example.com" } });
  if (existing) {
    console.warn("seed: demo merchant already present, skipping");
    return;
  }

  const merchant = await createMerchant(db, {
    name: "Demo Merchant",
    email: "demo@example.com",
    legalName: "Demo Company Co., Ltd.",
    taxCode: "0123456789",
  });

  const { secret } = await createApiKey(db, {
    merchantId: merchant.id,
    label: "default",
    scopes: ["shipments:write", "shipments:read", "rates:read", "webhooks:manage"],
  });

  console.warn("──────────────────────────────────────────────────────────────");
  console.warn(" Demo merchant seeded.");
  console.warn(` Merchant ID: ${merchant.id}`);
  console.warn(` API Key:     ${secret}`);
  console.warn(" Save this key — it will not be shown again.");
  console.warn("──────────────────────────────────────────────────────────────");
};

seed()
  .catch((err: unknown) => {
    console.error("seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
