import { request, type Dispatcher } from "undici";

import { CarrierError, CarrierUnavailableError } from "@usv/core";
import { carrierRequestDurationMs, carrierRequestsTotal, withSpan } from "@usv/observability";

export interface HttpClientOptions {
  baseUrl: string;
  carrier: string;
  defaultHeaders?: Record<string, string>;
  /** Total budget per request, including retries. */
  timeoutMs?: number;
  /** Max retry attempts on transient (5xx, network) errors. */
  maxRetries?: number;
}

export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Used both for OTel span name and metric labels. */
  operation: string;
}

const RETRYABLE_STATUS = new Set([502, 503, 504, 408, 425, 429]);

export class HttpClient {
  constructor(private readonly opts: HttpClientOptions) {}

  async json<T>(req: HttpRequestOptions): Promise<T> {
    const url = this.buildUrl(req.path, req.query);
    const attempts = (this.opts.maxRetries ?? 2) + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const started = Date.now();
      try {
        const res = await withSpan(`carrier.${this.opts.carrier}.${req.operation}`, () =>
          this.dispatch(url, req),
        );
        const duration = Date.now() - started;
        carrierRequestDurationMs().record(duration, {
          carrier: this.opts.carrier,
          operation: req.operation,
          status: String(res.statusCode),
        });
        carrierRequestsTotal().add(1, {
          carrier: this.opts.carrier,
          operation: req.operation,
          outcome: res.statusCode < 400 ? "ok" : "error",
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return (await res.body.json()) as T;
        }
        const bodyText = await res.body.text();
        if (RETRYABLE_STATUS.has(res.statusCode) && attempt < attempts) {
          await sleep(backoffMs(attempt));
          continue;
        }
        if (res.statusCode >= 500) {
          throw CarrierUnavailableError(this.opts.carrier);
        }
        throw CarrierError(`carrier ${this.opts.carrier} ${req.operation} failed`, {
          statusCode: res.statusCode,
          body: safeJson(bodyText),
        });
      } catch (err) {
        lastError = err;
        if (attempt < attempts && isNetworkError(err)) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastError ?? CarrierUnavailableError(this.opts.carrier);
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(path, this.opts.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async dispatch(url: string, req: HttpRequestOptions): Promise<Dispatcher.ResponseData> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "usv-shipping/0.1 (+https://github.com/unified-shipping-vn)",
      ...(this.opts.defaultHeaders ?? {}),
      ...(req.headers ?? {}),
    };
    return request(url, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      bodyTimeout: this.opts.timeoutMs ?? 15_000,
      headersTimeout: this.opts.timeoutMs ?? 15_000,
    });
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const backoffMs = (attempt: number) => {
  const base = Math.min(1_000 * 2 ** (attempt - 1), 8_000);
  return base + Math.floor(Math.random() * 250);
};

const isNetworkError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_SOCKET" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  );
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
