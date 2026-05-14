import type { WebhookEvent } from "@usv/core";

import { signOutboundWebhook } from "./signature.js";

export interface OutboundDeliveryRequest {
  endpointUrl: string;
  event: WebhookEvent;
  /** Per-endpoint signing secret (decrypted from DB). */
  secret: string;
  attempt: number;
  /** Override fetch for tests. */
  fetcher?: typeof fetch;
  /** Per-request timeout. */
  timeoutMs?: number;
}

export interface OutboundDeliveryResult {
  ok: boolean;
  statusCode: number | null;
  responseBodySnippet: string | null;
  errorMessage: string | null;
  retryable: boolean;
}

export const deliverWebhook = async (req: OutboundDeliveryRequest): Promise<OutboundDeliveryResult> => {
  const fetcher = req.fetcher ?? fetch;
  const body = JSON.stringify(req.event);
  const { signature, timestamp } = signOutboundWebhook(body, req.secret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 10_000);

  try {
    const res = await fetcher(req.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "usv-webhook/1.0",
        "x-usv-event-id": req.event.id,
        "x-usv-event-type": req.event.type,
        "x-usv-timestamp": String(timestamp),
        "x-usv-signature": signature,
        "x-usv-attempt": String(req.attempt),
      },
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      statusCode: res.status,
      responseBodySnippet: text.slice(0, 1024),
      errorMessage: ok ? null : `non-2xx: ${res.status}`,
      retryable: !ok && retryableStatus(res.status),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      statusCode: null,
      responseBodySnippet: null,
      errorMessage: (err as Error).message,
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
};

const retryableStatus = (status: number): boolean => status >= 500 || status === 408 || status === 429;

/**
 * Exponential backoff schedule for retries: 30s, 2m, 10m, 1h, 6h, 24h, 24h, 24h.
 * After 8 attempts the delivery is dead-lettered.
 */
const SCHEDULE_SECONDS = [30, 120, 600, 3600, 6 * 3600, 24 * 3600, 24 * 3600, 24 * 3600];

export const nextRetryDelaySeconds = (attempt: number): number | null => {
  if (attempt < 1 || attempt > SCHEDULE_SECONDS.length) return null;
  const base = SCHEDULE_SECONDS[attempt - 1]!;
  const jitter = Math.floor(Math.random() * Math.min(60, base / 10));
  return base + jitter;
};

export const MAX_ATTEMPTS = SCHEDULE_SECONDS.length;
