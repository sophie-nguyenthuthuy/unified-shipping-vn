import { createHash } from "node:crypto";

import type {
  CreateShipmentRequest,
  RateQuote,
  RateQuoteRequest,
  TrackingTimeline,
} from "@usv/core";
import { AuthenticationError } from "@usv/core";

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
 * J&T Express uses a signed-body scheme: digest = MD5(body + privateKey).
 * Scaffold provides signing helpers and webhook verification; request bodies
 * and status mapping are pending.
 */
export class JntAdapter implements CarrierAdapter {
  readonly carrier = "jnt" as const;
  private readonly http: HttpClient;
  private readonly apiAccount: string;
  private readonly privateKey: string;

  constructor(config: CarrierAdapterConfig) {
    const { apiAccount, privateKey } = config.credentials as { apiAccount?: string; privateKey?: string };
    if (!apiAccount || !privateKey) throw new Error("jnt: missing apiAccount or privateKey");
    this.apiAccount = apiAccount;
    this.privateKey = privateKey;
    this.http = new HttpClient({ baseUrl: config.baseUrl, carrier: "jnt", timeoutMs: 15_000 });
  }

  protected sign(body: string): string {
    return createHash("md5").update(body + this.privateKey).digest("hex");
  }

  quote(_req: RateQuoteRequest): Promise<RateQuote[]> {
    return Promise.resolve(notImplemented("jnt", "quote"));
  }
  createShipment(_req: CreateShipmentRequest, _opts: CreateShipmentOptions): Promise<CarrierCreateResult> {
    return Promise.resolve(notImplemented("jnt", "createShipment"));
  }
  cancelShipment(_carrierTrackingCode: string): Promise<void> {
    return Promise.resolve(notImplemented("jnt", "cancelShipment"));
  }
  track(_carrierTrackingCode: string): Promise<TrackingTimeline> {
    return Promise.resolve(notImplemented("jnt", "track"));
  }
  fetchLabel(_carrierTrackingCode: string): Promise<LabelArtifact> {
    return Promise.resolve(notImplemented("jnt", "fetchLabel"));
  }
  schedulePickup(_req: SchedulePickupRequest): Promise<PickupResult> {
    return Promise.resolve(notImplemented("jnt", "schedulePickup"));
  }

  async parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook> {
    const sigHeader = input.headers["digest"] ?? input.headers["x-jnt-digest"];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!sig) throw AuthenticationError("missing jnt digest");
    const expected = createHash("md5").update(input.rawBody.toString("utf8") + input.signingSecret).digest("hex");
    if (expected !== sig) throw AuthenticationError("jnt digest mismatch");
    return notImplemented("jnt", "parseWebhook.normalize");
  }
}
