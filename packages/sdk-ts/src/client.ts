import { randomUUID } from "node:crypto";

import type {
  CreateShipmentRequest,
  RateQuote,
  RateQuoteRequest,
  Shipment,
  TrackingTimeline,
} from "@usv/core";

export interface ClientOptions {
  /** Issued in the dashboard, prefix `usv_live_…`. */
  apiKey: string;
  /** API base URL. Defaults to https://api.usv.example.com. */
  baseUrl?: string;
  /** Override fetch (e.g., for tests or proxies). */
  fetcher?: typeof fetch;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Max retry attempts on 5xx/network errors. Default 2. */
  maxRetries?: number;
}

export class UsvClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly options: ClientOptions) {
    if (!options.apiKey) throw new Error("UsvClient: apiKey is required");
    this.baseUrl = (options.baseUrl ?? "https://api.usv.example.com").replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  quoteRates(req: RateQuoteRequest): Promise<RateQuote[]> {
    return this.request("POST", "/v1/rates/quote", req);
  }

  createShipment(req: CreateShipmentRequest, opts?: { idempotencyKey?: string }): Promise<Shipment> {
    return this.request("POST", "/v1/shipments", req, {
      idempotencyKey: opts?.idempotencyKey ?? randomUUID(),
    });
  }

  getShipment(id: string): Promise<Shipment> {
    return this.request("GET", `/v1/shipments/${encodeURIComponent(id)}`);
  }

  cancelShipment(id: string, reason?: string): Promise<Shipment> {
    return this.request("POST", `/v1/shipments/${encodeURIComponent(id)}/cancel`, { reason });
  }

  trackShipment(id: string): Promise<TrackingTimeline> {
    return this.request("GET", `/v1/shipments/${encodeURIComponent(id)}/tracking`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extra?: { idempotencyKey?: string },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const attempts = this.maxRetries + 1;
    let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetcher(url, {
          method,
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
            "user-agent": "@usv/sdk/0.1",
            ...(extra?.idempotencyKey ? { "idempotency-key": extra.idempotencyKey } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) return (await res.json()) as T;
        const text = await res.text().catch(() => "");
        const parsed = safeParse(text);
        if (res.status >= 500 && attempt < attempts) {
          await sleep(backoff(attempt));
          continue;
        }
        throw new UsvApiError(res.status, parsed ?? text);
      } catch (err) {
        last = err;
        if (attempt < attempts && isAbort(err)) {
          await sleep(backoff(attempt));
          continue;
        }
        if (err instanceof UsvApiError) throw err;
        if (attempt < attempts) {
          await sleep(backoff(attempt));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw last ?? new Error("request failed");
  }
}

export class UsvApiError extends Error {
  constructor(public readonly statusCode: number, public readonly body: unknown) {
    super(extractMessage(body) ?? `usv api error ${statusCode}`);
    this.name = "UsvApiError";
  }
}

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractMessage = (body: unknown): string | null => {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (e && typeof e === "object" && "message" in e) {
      const m = (e as { message: unknown }).message;
      return typeof m === "string" ? m : null;
    }
  }
  return null;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(500 * 2 ** (attempt - 1), 4_000) + Math.floor(Math.random() * 200);
const isAbort = (err: unknown) => err instanceof Error && err.name === "AbortError";
