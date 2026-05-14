import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  CreateShipmentRequest,
  RateQuote,
  RateQuoteRequest,
  TrackingTimeline,
} from "@usv/core";
import { AuthenticationError, CarrierError } from "@usv/core";

import type {
  CarrierAdapter,
  CarrierCreateResult,
  CreateShipmentOptions,
  LabelArtifact,
  NormalizedWebhook,
  ParseWebhookInput,
  PickupResult,
  SchedulePickupRequest,
} from "../common/contract.js";
import { HttpClient } from "../common/http.js";
import { notImplemented } from "../common/not-implemented.js";
import type { CarrierAdapterConfig } from "../common/registry.js";

/**
 * Ninja Van uses OAuth2 client_credentials. Scaffold handles the token
 * lifecycle and webhook signature verification; business mappings pending.
 */
export class NinjaVanAdapter implements CarrierAdapter {
  readonly carrier = "ninjavan" as const;
  private readonly http: HttpClient;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly country: string;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(config: CarrierAdapterConfig) {
    const { clientId, clientSecret, country } = config.credentials as {
      clientId?: string;
      clientSecret?: string;
      country?: string;
    };
    if (!clientId || !clientSecret) throw new Error("ninjavan: missing clientId/clientSecret");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.country = country ?? "vn";
    this.http = new HttpClient({ baseUrl: config.baseUrl, carrier: "ninjavan", timeoutMs: 15_000 });
  }

  protected async ensureAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000) return this.accessToken.value;
    const res = await this.http.json<{ access_token: string; expires_in: number }>({
      method: "POST",
      path: `/${this.country}/2.0/oauth/access_token`,
      operation: "oauth_token",
      body: { client_id: this.clientId, client_secret: this.clientSecret, grant_type: "client_credentials" },
    });
    if (!res.access_token) throw CarrierError("ninjavan oauth failed");
    this.accessToken = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
    return res.access_token;
  }

  quote(_req: RateQuoteRequest): Promise<RateQuote[]> {
    return Promise.resolve(notImplemented("ninjavan", "quote"));
  }
  createShipment(_req: CreateShipmentRequest, _opts: CreateShipmentOptions): Promise<CarrierCreateResult> {
    return Promise.resolve(notImplemented("ninjavan", "createShipment"));
  }
  cancelShipment(_carrierTrackingCode: string): Promise<void> {
    return Promise.resolve(notImplemented("ninjavan", "cancelShipment"));
  }
  track(_carrierTrackingCode: string): Promise<TrackingTimeline> {
    return Promise.resolve(notImplemented("ninjavan", "track"));
  }
  fetchLabel(_carrierTrackingCode: string): Promise<LabelArtifact> {
    return Promise.resolve(notImplemented("ninjavan", "fetchLabel"));
  }
  schedulePickup(_req: SchedulePickupRequest): Promise<PickupResult> {
    return Promise.resolve(notImplemented("ninjavan", "schedulePickup"));
  }

  async parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook> {
    const sigHeader = input.headers["x-ninjavan-hmac-sha256"];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!sig) throw AuthenticationError("missing ninjavan signature");
    const expected = createHmac("sha256", input.signingSecret).update(input.rawBody).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw AuthenticationError("ninjavan signature mismatch");
    return notImplemented("ninjavan", "parseWebhook.normalize");
  }
}
