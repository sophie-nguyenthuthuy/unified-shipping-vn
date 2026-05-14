import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Outbound webhook signing — what *we* attach to events we deliver to merchants.
 *
 * Headers we set:
 *   X-USV-Timestamp: unix seconds when the event was sent
 *   X-USV-Signature: t=<ts>,v1=<hex hmac-sha256 of `${ts}.${body}`>
 *
 * Merchants verify by recomputing v1 and comparing in constant time.
 * Timestamps older than `TOLERANCE_SECONDS` are rejected to limit replay.
 */

const TOLERANCE_SECONDS = 5 * 60;

export const signOutboundWebhook = (rawBody: string | Buffer, secret: string, ts = Math.floor(Date.now() / 1000)) => {
  const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const v1 = createHmac("sha256", secret).update(`${ts}.${bodyStr}`).digest("hex");
  return {
    timestamp: ts,
    signature: `t=${ts},v1=${v1}`,
  };
};

export interface VerifyOutboundOptions {
  rawBody: string | Buffer;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
}

export const verifyOutboundWebhook = (opts: VerifyOutboundOptions): { ok: true } | { ok: false; reason: string } => {
  if (!opts.signatureHeader || !opts.timestampHeader) return { ok: false, reason: "missing_signature_headers" };
  const ts = Number.parseInt(opts.timestampHeader, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const now = (opts.now ?? (() => Math.floor(Date.now() / 1000)))();
  const tol = opts.toleranceSeconds ?? TOLERANCE_SECONDS;
  if (Math.abs(now - ts) > tol) return { ok: false, reason: "timestamp_outside_tolerance" };

  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return idx >= 0 ? [p.slice(0, idx).trim(), p.slice(idx + 1).trim()] : [p.trim(), ""];
    }),
  );
  const v1 = parts.v1;
  if (!v1) return { ok: false, reason: "missing_v1" };

  const bodyStr = typeof opts.rawBody === "string" ? opts.rawBody : opts.rawBody.toString("utf8");
  const expected = createHmac("sha256", opts.secret).update(`${ts}.${bodyStr}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature_mismatch" };
  return { ok: true };
};
