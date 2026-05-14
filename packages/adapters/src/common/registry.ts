import type { CarrierCode } from "@usv/core";

import type { CarrierAdapter } from "./contract.js";

export type AdapterFactory = (config: CarrierAdapterConfig) => CarrierAdapter;

export interface CarrierAdapterConfig {
  baseUrl: string;
  /** Carrier-decrypted credentials object — adapters know their own shape. */
  credentials: Record<string, unknown>;
  /** Public config (shop id, sender code, etc). */
  publicConfig?: Record<string, unknown>;
}

export interface AdapterRegistry {
  resolve(carrier: CarrierCode, config: CarrierAdapterConfig): CarrierAdapter;
}

export class StaticAdapterRegistry implements AdapterRegistry {
  constructor(private readonly factories: Record<CarrierCode, AdapterFactory>) {}

  resolve(carrier: CarrierCode, config: CarrierAdapterConfig): CarrierAdapter {
    const factory = this.factories[carrier];
    if (!factory) throw new Error(`no adapter registered for carrier=${carrier}`);
    return factory(config);
  }
}
