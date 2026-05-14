import { createHmac, timingSafeEqual } from "node:crypto";

import {
  AuthenticationError,
  CarrierError,
  NotFoundError,
  ValidationError,
  newId,
  vnd,
  type CreateShipmentRequest,
  type RateQuote,
  type RateQuoteRequest,
  type ShipmentStatus,
  type TrackingTimeline,
  type WebhookEvent,
} from "@usv/core";

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
import type { CarrierAdapterConfig } from "../common/registry.js";

import { mapGhtkStatus } from "./status-mapping.js";
import type {
  GhtkCancelResponse,
  GhtkCreateOrderRequest,
  GhtkCreateOrderResponse,
  GhtkFeeResponse,
  GhtkOrderDetailResponse,
  GhtkWebhookPayload,
} from "./types.js";

interface GhtkCredentials {
  token: string;
  /** Optional partner_id; some accounts require it on order creation. */
  partnerId?: string;
}

/**
 * GHTK partner API adapter.
 *
 * Auth:   `Token: <secret>` header. No body signing for the REST API.
 * Webhook: HMAC-SHA256(rawBody, signing_secret) → header `X-Secure-Key` (hex).
 *
 * Gotchas that bite every team integrating GHTK for the first time:
 *
 *   1. Weight: GHTK interprets `total_weight` as KILOGRAMS by default. We set
 *      `weight_option: "gram"` explicitly to keep the wire integer.
 *   2. Addresses: human-readable strings (`"Quận 1"`), not GSO codes. GHTK
 *      does its own gazetteer mapping; mismatches return success:false.
 *   3. `pick_money` is COD value. Zero = non-COD; omitting it = "let GHTK
 *      decide", which is rarely what we want.
 *   4. `is_freeship: 1` means the merchant pays shipping; `0` adds shipping
 *      to what the recipient pays alongside COD at delivery.
 *   5. Tracking IDs (`label`) have the form `S<shop>.<seq>` or
 *      `S<shop>.A<seq>` — they are NOT alphanumeric-only.
 */
export class GhtkAdapter implements CarrierAdapter {
  readonly carrier = "ghtk" as const;
  private readonly http: HttpClient;
  private readonly creds: GhtkCredentials;
  private readonly baseUrl: string;

  constructor(config: CarrierAdapterConfig) {
    this.creds = parseCreds(config.credentials);
    this.baseUrl = config.baseUrl;
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      carrier: "ghtk",
      defaultHeaders: { Token: this.creds.token },
      timeoutMs: 15_000,
      maxRetries: 2,
    });
  }

  async quote(req: RateQuoteRequest): Promise<RateQuote[]> {
    const res = await this.http.json<GhtkFeeResponse>({
      method: "GET",
      path: "/services/shipment/fee",
      operation: "quote",
      query: {
        pick_province: req.fromProvinceCode,
        pick_district: req.fromDistrictCode,
        province: req.toProvinceCode,
        district: req.toDistrictCode,
        weight: req.weightGrams,
        value: req.declaredValue.amount,
        deliver_option: "none",
        transport: "road",
      },
    });
    if (!res.success || !res.fee) {
      throw CarrierError("ghtk quote failed", { message: res.message });
    }
    const insurance = res.fee.insurance_fee;
    const total = res.fee.fee + (insurance ?? 0);
    return [
      {
        carrier: "ghtk",
        serviceLevel: "standard",
        serviceCode: "GHTK_STD",
        serviceName: res.fee.name ?? "GHTK Standard",
        fee: vnd(total),
        insurance: insurance ? vnd(insurance) : undefined,
        expectedDeliveryFrom: res.fee.dt,
        expectedDeliveryTo: res.fee.dt,
      },
    ];
  }

  async createShipment(
    req: CreateShipmentRequest,
    _opts: CreateShipmentOptions,
  ): Promise<CarrierCreateResult> {
    const body: GhtkCreateOrderRequest = {
      products: req.parcel.items.map((it) => ({
        name: it.name,
        weight: it.weightGrams,
        quantity: it.quantity,
        product_code: it.sku,
        price: it.declaredValue.amount,
      })),
      order: {
        id: req.merchantOrderId,
        pick_name: req.pickup.name,
        pick_money: req.cashOnDelivery?.amount ?? 0,
        pick_address: req.pickup.street,
        pick_province: req.pickup.province.name,
        pick_district: req.pickup.district.name,
        pick_ward: req.pickup.ward.name,
        pick_tel: stripPlus(req.pickup.phone),
        tel: stripPlus(req.delivery.phone),
        name: req.delivery.name,
        address: req.delivery.street,
        province: req.delivery.province.name,
        district: req.delivery.district.name,
        ward: req.delivery.ward.name,
        is_freeship: 1,
        deliver_option: "none",
        transport: "road",
        weight_option: "gram",
        total_weight: req.parcel.totalWeightGrams,
        value: req.parcel.declaredValue.amount,
        note: req.note,
      },
    };

    const res = await this.http.json<GhtkCreateOrderResponse>({
      method: "POST",
      path: "/services/shipment/order",
      operation: "create",
      body,
    });
    if (!res.success || !res.order) {
      throw CarrierError("ghtk create failed", { message: res.message });
    }
    const shippingFee = res.order.fee;
    const insurance = res.order.insurance_fee ?? 0;
    return {
      carrierTrackingCode: res.order.label,
      fees: {
        shippingFee: vnd(shippingFee),
        insuranceFee: insurance ? vnd(insurance) : undefined,
        // GHTK does not separate the COD fee on creation; it is bundled into
        // `fee`. We surface 0 here and recover the breakdown at reconciliation
        // time from the remittance report.
        codFee: undefined,
        totalFee: vnd(shippingFee + insurance),
      },
      expectedDeliveryFrom: res.order.estimated_pick_time,
      expectedDeliveryTo: res.order.estimated_deliver_time,
    };
  }

  async cancelShipment(carrierTrackingCode: string, opts?: { reason?: string }): Promise<void> {
    if (!carrierTrackingCode) throw ValidationError("carrierTrackingCode required");
    const res = await this.http.json<GhtkCancelResponse>({
      method: "POST",
      path: `/services/shipment/cancel/${encodeURIComponent(carrierTrackingCode)}`,
      operation: "cancel",
    });
    if (!res.success) {
      // GHTK returns success:false when the shipment is in a state that can't
      // be cancelled (e.g. delivered). Surface with a clear message so callers
      // can treat it idempotently rather than retrying.
      throw CarrierError("ghtk cancel failed", {
        message: res.message,
        carrierTrackingCode,
      });
    }
    void opts; // reason intentionally unused — GHTK partner API doesn't accept it
  }

  async track(carrierTrackingCode: string): Promise<TrackingTimeline> {
    const res = await this.http.json<GhtkOrderDetailResponse>({
      method: "GET",
      path: `/services/shipment/v2/${encodeURIComponent(carrierTrackingCode)}`,
      operation: "track",
    });
    if (!res.success || !res.order) {
      throw NotFoundError(`ghtk shipment ${carrierTrackingCode}`);
    }
    const order = res.order;
    const currentStatus = mapGhtkStatus(order.status);
    const events = (order.log ?? [])
      .map((l) => ({
        // GHTK log entries don't carry a numeric status_id, only `action`
        // text. Map the informative cases; otherwise inherit the current
        // shipment status so the timeline stays monotonic.
        status: inferStatusFromLog(l.action, currentStatus),
        occurredAt: parseGhtkDate(l.action_time),
        location: undefined,
        note: l.status_text ?? l.reason,
        carrierRawCode: undefined,
        carrierRawDescription: l.action,
      }))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    // Ensure the current status appears as the most recent event even when
    // the log is sparse — many GHTK accounts only emit pickup and delivery.
    if (events.length === 0 || events[events.length - 1]!.status !== currentStatus) {
      events.push({
        status: currentStatus,
        occurredAt: parseGhtkDate(order.modified),
        location: undefined,
        note: order.status_text,
        carrierRawCode: order.status,
        carrierRawDescription: order.message,
      });
    }

    return { carrierTrackingCode, currentStatus, events };
  }

  async fetchLabel(carrierTrackingCode: string): Promise<LabelArtifact> {
    // GHTK serves PDFs from a URL; the partner Token query-param authenticates
    // the download. Returning the URL lets browsers/CDNs fetch directly.
    const url = new URL(`/services/label/${encodeURIComponent(carrierTrackingCode)}`, this.baseUrl);
    url.searchParams.set("token", this.creds.token);
    return { format: "pdf", size: "A6", url: url.toString() };
  }

  async schedulePickup(req: SchedulePickupRequest): Promise<PickupResult> {
    // GHTK does not expose a partner-API pickup endpoint; pickup is auto-
    // scheduled off the order's `pick_date`. We return a synthetic code so
    // callers get a consistent shape across carriers.
    return {
      pickupCode: `ghtk_${newId("shipment")}`,
      scheduledFor: req.pickupTimeFrom,
    };
  }

  async parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook> {
    const sigHeader = input.headers["x-secure-key"] ?? input.headers["x-ghtk-signature"];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!signature) throw AuthenticationError("missing ghtk signature");

    const expected = createHmac("sha256", input.signingSecret).update(input.rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw AuthenticationError("ghtk signature mismatch");
    }

    const payload = JSON.parse(input.rawBody.toString("utf8")) as GhtkWebhookPayload;
    const status: ShipmentStatus = mapGhtkStatus(payload.status_id);
    const occurredAt = payload.action_time ? parseGhtkDate(payload.action_time) : new Date().toISOString();

    const event: WebhookEvent = {
      id: newId("webhookEvent"),
      type: status === "delivered" ? "shipment.delivered" : "shipment.status_changed",
      occurredAt,
      merchantId: "", // filled by the webhook router after merchant resolution
      data: {
        carrierTrackingCode: payload.label_id,
        merchantOrderId: payload.partner_id,
        status,
        carrierRawCode: String(payload.status_id),
        reason: payload.reason,
      },
    };
    return {
      externalId: `ghtk:${payload.label_id}:${payload.status_id}:${occurredAt}`,
      events: [event],
    };
  }
}

const parseCreds = (raw: Record<string, unknown>): GhtkCredentials => {
  if (typeof raw.token !== "string" || raw.token.length === 0) {
    throw CarrierError("ghtk: missing token in credentials");
  }
  const partnerId = typeof raw.partnerId === "string" ? raw.partnerId : undefined;
  return { token: raw.token, ...(partnerId ? { partnerId } : {}) };
};

const stripPlus = (e164: string) => e164.replace(/^\+/, "");

/**
 * GHTK timestamps are `YYYY-MM-DD HH:mm:ss` in Asia/Ho_Chi_Minh (UTC+7)
 * with no timezone suffix. We assume +07:00 and convert to ISO-8601 UTC.
 */
const parseGhtkDate = (raw: string | undefined): string => {
  if (!raw) return new Date().toISOString();
  if (/T\d{2}:\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const [, y, mo, d, h, mi, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`).toISOString();
};

const inferStatusFromLog = (action: string, fallback: ShipmentStatus): ShipmentStatus => {
  const a = action.toLowerCase();
  if (a.includes("đã giao") || a.includes("delivered")) return "delivered";
  if (a.includes("đang giao") || a.includes("out for delivery")) return "out_for_delivery";
  if (a.includes("đã lấy") || a.includes("picked")) return "picked_up";
  if (a.includes("hủy") || a.includes("cancel")) return "cancelled";
  if (a.includes("trả hàng") || a.includes("return")) return "returning";
  if (a.includes("không giao")) return "delivery_failed";
  return fallback;
};
