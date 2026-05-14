/**
 * Stable error codes that surface in API responses and the SDK.
 * Treat as a public contract — adding is fine, renaming is breaking.
 */
export type ErrorCode =
  | "validation_failed"
  | "authentication_failed"
  | "authorization_failed"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "idempotency_conflict"
  | "carrier_error"
  | "carrier_unavailable"
  | "carrier_invalid_credentials"
  | "carrier_address_not_serviceable"
  | "cod_amount_mismatch"
  | "internal_error"
  | "feature_disabled";

export interface UsvErrorOptions {
  code: ErrorCode;
  httpStatus: number;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
  retryable?: boolean;
}

export class UsvError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;
  readonly retryable: boolean;

  constructor(opts: UsvErrorOptions) {
    super(opts.message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "UsvError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.details = opts.details;
    this.retryable = opts.retryable ?? false;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const ValidationError = (message: string, details?: Record<string, unknown>) =>
  new UsvError({
    code: "validation_failed",
    httpStatus: 422,
    message,
    ...(details ? { details } : {}),
  });

export const NotFoundError = (resource: string) =>
  new UsvError({ code: "not_found", httpStatus: 404, message: `${resource} not found` });

export const ConflictError = (message: string, details?: Record<string, unknown>) =>
  new UsvError({
    code: "conflict",
    httpStatus: 409,
    message,
    ...(details ? { details } : {}),
  });

export const AuthenticationError = (message = "authentication failed") =>
  new UsvError({ code: "authentication_failed", httpStatus: 401, message });

export const AuthorizationError = (message = "forbidden") =>
  new UsvError({ code: "authorization_failed", httpStatus: 403, message });

export const RateLimitedError = (retryAfterSec: number) =>
  new UsvError({
    code: "rate_limited",
    httpStatus: 429,
    message: "rate limited",
    details: { retryAfterSec },
    retryable: true,
  });

export const CarrierError = (message: string, details?: Record<string, unknown>) =>
  new UsvError({
    code: "carrier_error",
    httpStatus: 502,
    message,
    ...(details ? { details } : {}),
    retryable: true,
  });

export const CarrierUnavailableError = (carrier: string) =>
  new UsvError({
    code: "carrier_unavailable",
    httpStatus: 503,
    message: `carrier ${carrier} unavailable`,
    details: { carrier },
    retryable: true,
  });

export const IdempotencyConflictError = (key: string) =>
  new UsvError({
    code: "idempotency_conflict",
    httpStatus: 409,
    message: "idempotency key reused with different request body",
    details: { key },
  });
