import {
  GhnAdapter,
  GhtkAdapter,
  JntAdapter,
  NinjaVanAdapter,
  StaticAdapterRegistry,
  ViettelPostAdapter,
  type CarrierAdapter,
} from "@usv/adapters";
import type { CarrierCode } from "@usv/core";
import type { CarrierAccount } from "@usv/db";
import type { FastifyInstance } from "fastify";

import { getSecretStore } from "./secret-store.js";

const registry = new StaticAdapterRegistry({
  ghn: (c) => new GhnAdapter(c),
  ghtk: (c) => new GhtkAdapter(c),
  jnt: (c) => new JntAdapter(c),
  viettelpost: (c) => new ViettelPostAdapter(c),
  ninjavan: (c) => new NinjaVanAdapter(c),
});

const CARRIER_BASE_URLS: Record<CarrierCode, string> = {
  ghn: process.env.GHN_BASE_URL ?? "https://online-gateway.ghn.vn",
  ghtk: process.env.GHTK_BASE_URL ?? "https://services.giaohangtietkiem.vn",
  jnt: process.env.JNT_BASE_URL ?? "https://openapi.jtexpress.vn",
  viettelpost: process.env.VTP_BASE_URL ?? "https://partner.viettelpost.vn",
  ninjavan: process.env.NINJAVAN_BASE_URL ?? "https://api.ninjavan.co",
};

/**
 * Decrypt the carrier account's credentials and return a configured adapter.
 *
 * Decryption happens here, not in the adapter, for three reasons:
 *   1. Adapters stay pure of KMS concerns and remain trivially testable.
 *   2. The KMS round-trip cost is visible in this service's span, not
 *      smeared across adapter code paths.
 *   3. We can cache adapters per-account without leaking plaintext beyond
 *      a single request scope.
 */
export const resolveAdapter = async (
  _app: FastifyInstance,
  account: CarrierAccount,
): Promise<CarrierAdapter> => {
  const carrier = account.carrier as CarrierCode;
  const credentials = await loadCredentials(account);
  return registry.resolve(carrier, {
    baseUrl: CARRIER_BASE_URLS[carrier],
    credentials,
    publicConfig: (account.config as Record<string, unknown>) ?? {},
  });
};

const loadCredentials = async (account: CarrierAccount): Promise<Record<string, unknown>> => {
  if (!account.encryptedSecret || account.encryptedSecret.length === 0) {
    // Pre-encryption accounts kept plaintext credentials in `config`. We
    // accept those for migration; new writes always seal into encryptedSecret.
    return (account.config as Record<string, unknown>) ?? {};
  }
  const store = await getSecretStore();
  return store.openJson<Record<string, unknown>>(account.encryptedSecret);
};
