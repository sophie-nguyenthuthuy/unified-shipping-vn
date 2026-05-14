import type { PrismaClient } from "@prisma/client";

import { newId } from "@usv/core";

export interface CreateMerchantInput {
  name: string;
  email: string;
  legalName?: string;
  taxCode?: string;
  phone?: string;
}

export const createMerchant = async (db: PrismaClient, input: CreateMerchantInput) =>
  db.merchant.create({
    data: {
      id: newId("merchant"),
      name: input.name,
      email: input.email,
      legalName: input.legalName ?? null,
      taxCode: input.taxCode ?? null,
      phone: input.phone ?? null,
    },
  });

export const findMerchantById = (db: PrismaClient, id: string) =>
  db.merchant.findUnique({ where: { id } });
