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
 * Viettel Post authenticates with a username/password login that returns a
 * session token; the token expires and must be refreshed. This scaffold
 * implements the auth dance but leaves request/response mapping pending.
 */
export class ViettelPostAdapter implements CarrierAdapter {
  readonly carrier = "viettelpost" as const;
  private readonly http: HttpClient;
  private readonly username: string;
  private readonly password: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: CarrierAdapterConfig) {
    const { username, password } = config.credentials as { username?: string; password?: string };
    if (!username || !password) throw new Error("viettelpost: missing username/password");
    this.username = username;
    this.password = password;
    this.http = new HttpClient({ baseUrl: config.baseUrl, carrier: "viettelpost", timeoutMs: 15_000 });
  }

  protected async ensureToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const res = await this.http.json<{ status: number; data?: { token: string; expired: string } }>({
      method: "POST",
      path: "/v2/user/Login",
      operation: "login",
      body: { USERNAME: this.username, PASSWORD: this.password },
    });
    if (res.status !== 200 || !res.data) throw CarrierError("viettelpost login failed");
    this.token = { value: res.data.token, expiresAt: new Date(res.data.expired).getTime() };
    return this.token.value;
  }

  quote(_req: RateQuoteRequest): Promise<RateQuote[]> {
    return Promise.resolve(notImplemented("viettelpost", "quote"));
  }
  createShipment(_req: CreateShipmentRequest, _opts: CreateShipmentOptions): Promise<CarrierCreateResult> {
    return Promise.resolve(notImplemented("viettelpost", "createShipment"));
  }
  cancelShipment(_carrierTrackingCode: string): Promise<void> {
    return Promise.resolve(notImplemented("viettelpost", "cancelShipment"));
  }
  track(_carrierTrackingCode: string): Promise<TrackingTimeline> {
    return Promise.resolve(notImplemented("viettelpost", "track"));
  }
  fetchLabel(_carrierTrackingCode: string): Promise<LabelArtifact> {
    return Promise.resolve(notImplemented("viettelpost", "fetchLabel"));
  }
  schedulePickup(_req: SchedulePickupRequest): Promise<PickupResult> {
    return Promise.resolve(notImplemented("viettelpost", "schedulePickup"));
  }

  async parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook> {
    const sig = input.headers["x-vtp-signature"];
    if (!sig) throw AuthenticationError("missing viettelpost signature");
    return notImplemented("viettelpost", "parseWebhook.normalize");
  }
}
