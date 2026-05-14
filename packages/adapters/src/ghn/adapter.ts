import { createHmac, timingSafeEqual } from "node:crypto";

import {
  CarrierError,
  newId,
  vnd,
  type CreateShipmentRequest,
  type RateQuote,
  type RateQuoteRequest,
  type TrackingTimeline,
  type WebhookEvent,
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
import type { CarrierAdapterConfig } from "../common/registry.js";

import { mapGhnStatus } from "./status-mapping.js";

interface GhnCredentials {
  token: string;
  shopId: number | string;
}

interface GhnQuoteResponse {
  code: number;
  message: string;
  data?: {
    total: number;
    service_fee: number;
    insurance_fee: number;
    cod_fee: number;
    expected_delivery_time: string;
  };
}

interface GhnCreateResponse {
  code: number;
  message: string;
  data?: {
    order_code: string;
    total_fee: number;
    expected_delivery_time: string;
    fee: { main_service: number; insurance: number; cod_fee: number };
  };
}

interface GhnTrackResponse {
  code: number;
  data?: {
    order_code: string;
    status: string;
    log: Array<{ status: string; updated_date: string; location?: string; note?: string }>;
  };
}

interface GhnWebhookPayload {
  OrderCode: string;
  Status: string;
  Time: string;
  ShopID: number;
  Description?: string;
  Location?: string;
}

export class GhnAdapter implements CarrierAdapter {
  readonly carrier = "ghn" as const;
  private readonly http: HttpClient;
  private readonly creds: GhnCredentials;

  constructor(config: CarrierAdapterConfig) {
    this.creds = parseCreds(config.credentials);
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      carrier: "ghn",
      defaultHeaders: { Token: this.creds.token, ShopId: String(this.creds.shopId) },
      timeoutMs: 12_000,
      maxRetries: 2,
    });
  }

  async quote(req: RateQuoteRequest): Promise<RateQuote[]> {
    const res = await this.http.json<GhnQuoteResponse>({
      method: "POST",
      path: "/shiip/public-api/v2/shipping-order/fee",
      operation: "quote",
      body: {
        from_district_id: toInt(req.fromDistrictCode),
        to_district_id: toInt(req.toDistrictCode),
        to_ward_code: req.toWardCode,
        weight: req.weightGrams,
        insurance_value: req.declaredValue.amount,
        cod_value: req.cashOnDelivery?.amount ?? 0,
        service_type_id: 2,
      },
    });
    if (res.code !== 200 || !res.data) {
      throw CarrierError("ghn quote failed", { code: res.code, message: res.message });
    }
    return [
      {
        carrier: "ghn",
        serviceLevel: "standard",
        serviceCode: "GHN_STD",
        serviceName: "GHN Standard",
        fee: vnd(res.data.total),
        codFee: vnd(res.data.cod_fee),
        insurance: vnd(res.data.insurance_fee),
        expectedDeliveryFrom: res.data.expected_delivery_time,
        expectedDeliveryTo: res.data.expected_delivery_time,
      },
    ];
  }

  async createShipment(
    req: CreateShipmentRequest,
    opts: CreateShipmentOptions,
  ): Promise<CarrierCreateResult> {
    const res = await this.http.json<GhnCreateResponse>({
      method: "POST",
      path: "/shiip/public-api/v2/shipping-order/create",
      operation: "create",
      headers: { "Idempotency-Key": opts.idempotencyKey },
      body: {
        client_order_code: req.merchantOrderId,
        to_name: req.delivery.name,
        to_phone: stripPlus(req.delivery.phone),
        to_address: req.delivery.street,
        to_ward_code: req.delivery.ward.code,
        to_district_id: toInt(req.delivery.district.code),
        from_name: req.pickup.name,
        from_phone: stripPlus(req.pickup.phone),
        from_address: req.pickup.street,
        from_ward_code: req.pickup.ward.code,
        from_district_id: toInt(req.pickup.district.code),
        weight: req.parcel.totalWeightGrams,
        length: req.parcel.dimensions.lengthCm,
        width: req.parcel.dimensions.widthCm,
        height: req.parcel.dimensions.heightCm,
        insurance_value: req.parcel.declaredValue.amount,
        cod_amount: req.cashOnDelivery?.amount ?? 0,
        service_type_id: 2,
        payment_type_id: 2,
        required_note: "CHOXEMHANGKHONGTHU",
        items: req.parcel.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          weight: it.weightGrams,
          price: it.declaredValue.amount,
        })),
      },
    });
    if (res.code !== 200 || !res.data) {
      throw CarrierError("ghn create failed", { code: res.code, message: res.message });
    }
    const fee = res.data.fee;
    return {
      carrierTrackingCode: res.data.order_code,
      fees: {
        shippingFee: vnd(fee.main_service),
        insuranceFee: vnd(fee.insurance),
        codFee: vnd(fee.cod_fee),
        totalFee: vnd(res.data.total_fee),
      },
      expectedDeliveryFrom: res.data.expected_delivery_time,
      expectedDeliveryTo: res.data.expected_delivery_time,
    };
  }

  async cancelShipment(carrierTrackingCode: string): Promise<void> {
    const res = await this.http.json<{ code: number; message: string }>({
      method: "POST",
      path: "/shiip/public-api/v2/switch-status/cancel",
      operation: "cancel",
      body: { order_codes: [carrierTrackingCode] },
    });
    if (res.code !== 200) throw CarrierError("ghn cancel failed", { message: res.message });
  }

  async track(carrierTrackingCode: string): Promise<TrackingTimeline> {
    const res = await this.http.json<GhnTrackResponse>({
      method: "POST",
      path: "/shiip/public-api/v2/shipping-order/detail",
      operation: "track",
      body: { order_code: carrierTrackingCode },
    });
    if (res.code !== 200 || !res.data) throw CarrierError("ghn track failed");

    const events = res.data.log
      .map((l) => ({
        status: mapGhnStatus(l.status),
        occurredAt: new Date(l.updated_date).toISOString(),
        location: l.location ?? undefined,
        note: l.note ?? undefined,
        carrierRawCode: l.status,
        carrierRawDescription: l.note ?? undefined,
      }))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    return {
      carrierTrackingCode,
      currentStatus: mapGhnStatus(res.data.status),
      events,
    };
  }

  async fetchLabel(carrierTrackingCode: string): Promise<LabelArtifact> {
    const res = await this.http.json<{ code: number; data?: { token: string } }>({
      method: "POST",
      path: "/shiip/public-api/v2/a5/gen-token",
      operation: "label_token",
      body: { order_codes: [carrierTrackingCode] },
    });
    if (res.code !== 200 || !res.data) throw CarrierError("ghn label token failed");
    return {
      format: "pdf",
      size: "A6",
      url: `${new URL("/a5/public-api/print", "https://dev-online-gateway.ghn.vn").toString()}?token=${res.data.token}`,
    };
  }

  async schedulePickup(req: SchedulePickupRequest): Promise<PickupResult> {
    return {
      pickupCode: `ghn_${newId("shipment")}`,
      scheduledFor: req.pickupTimeFrom,
    };
  }

  async parseWebhook(input: ParseWebhookInput): Promise<NormalizedWebhook> {
    const signature = headerString(input.headers, "x-ghn-signature");
    if (!signature) throw AuthenticationError("missing ghn signature");
    const expected = createHmac("sha256", input.signingSecret).update(input.rawBody).digest("hex");
    if (!timingEqual(expected, signature)) throw AuthenticationError("ghn signature mismatch");

    const payload = JSON.parse(input.rawBody.toString("utf8")) as GhnWebhookPayload;
    const status = mapGhnStatus(payload.Status);
    const event: WebhookEvent = {
      id: newId("webhookEvent"),
      type: status === "delivered" ? "shipment.delivered" : "shipment.status_changed",
      occurredAt: new Date(payload.Time).toISOString(),
      merchantId: "", // filled by webhook router after merchant resolution
      data: {
        carrierTrackingCode: payload.OrderCode,
        status,
        carrierRawCode: payload.Status,
      },
    };
    return {
      externalId: `ghn:${payload.OrderCode}:${payload.Status}:${payload.Time}`,
      events: [event],
    };
  }
}

const parseCreds = (raw: Record<string, unknown>): GhnCredentials => {
  if (typeof raw.token !== "string" || raw.token.length === 0)
    throw CarrierError("ghn: missing token in credentials");
  if (raw.shopId === undefined) throw CarrierError("ghn: missing shopId in credentials");
  return { token: raw.token, shopId: raw.shopId as string | number };
};

const toInt = (s: string): number => {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) throw new Error(`expected integer code, got ${s}`);
  return n;
};

const stripPlus = (e164: string) => e164.replace(/^\+/, "");

const headerString = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined => {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
};

const timingEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
};
