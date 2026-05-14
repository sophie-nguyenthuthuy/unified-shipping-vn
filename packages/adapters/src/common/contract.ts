import type {
  CarrierCode,
  CreateShipmentRequest,
  RateQuote,
  RateQuoteRequest,
  Shipment,
  TrackingTimeline,
  WebhookEvent,
} from "@usv/core";

/**
 * Carrier-agnostic adapter contract. Each implementation lives in its own
 * subdirectory and must pass the shared contract test suite under
 * `test/contract.suite.ts`.
 *
 * Implementations:
 *   - MUST be idempotent on retryable operations (use the caller-provided id).
 *   - MUST translate carrier-specific errors into `UsvError` subclasses.
 *   - MUST emit pino-compatible logs through the injected `logger`.
 *   - MUST NOT keep mutable per-request state on the instance.
 */
export interface CarrierAdapter {
  readonly carrier: CarrierCode;

  quote(req: RateQuoteRequest): Promise<RateQuote[]>;

  createShipment(req: CreateShipmentRequest, opts: CreateShipmentOptions): Promise<CarrierCreateResult>;

  cancelShipment(carrierTrackingCode: string, opts?: { reason?: string }): Promise<void>;

  track(carrierTrackingCode: string): Promise<TrackingTimeline>;

  /** Carrier-issued PDF label (A6 by default). May be a URL or buffer per carrier. */
  fetchLabel(carrierTrackingCode: string, opts?: { format?: "pdf" | "png"; size?: "A4" | "A6" }): Promise<LabelArtifact>;

  schedulePickup(req: SchedulePickupRequest): Promise<PickupResult>;

  /**
   * Verify and normalize an inbound webhook from this carrier.
   * Throws UsvError("authentication_failed") if the signature does not match.
   */
  parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook>;
}

export interface CreateShipmentOptions {
  /** Caller-provided id used by the adapter to dedupe at the carrier when supported. */
  idempotencyKey: string;
}

export interface CarrierCreateResult {
  carrierTrackingCode: string;
  /** Carrier-confirmed shipping fee breakdown. */
  fees: Pick<Shipment, "shippingFee" | "insuranceFee" | "codFee" | "totalFee">;
  expectedDeliveryFrom?: string;
  expectedDeliveryTo?: string;
  labelUrl?: string;
}

export interface LabelArtifact {
  format: "pdf" | "png";
  size: "A4" | "A6";
  /** Either a URL (carrier-hosted) or inline binary content. */
  url?: string;
  content?: Buffer;
}

export interface SchedulePickupRequest {
  carrierTrackingCodes: string[];
  pickupTimeFrom: string;
  pickupTimeTo: string;
  note?: string;
}

export interface PickupResult {
  pickupCode: string;
  scheduledFor: string;
}

export interface ParseWebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  /** Secret shared between us and the carrier (or carrier public key). */
  signingSecret: string;
}

export interface NormalizedWebhook {
  /**
   * Carrier-issued event id, used for idempotency. If the carrier doesn't
   * provide one, derive a stable hash from (tracking_code, status, occurredAt).
   */
  externalId: string;
  events: WebhookEvent[];
}
