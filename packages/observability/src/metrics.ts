import { metrics } from "@opentelemetry/api";

const meter = () => metrics.getMeter("@usv/observability");

export const httpRequestsTotal = () =>
  meter().createCounter("http_requests_total", { description: "HTTP requests handled" });

export const carrierRequestsTotal = () =>
  meter().createCounter("carrier_requests_total", { description: "Outbound carrier API calls" });

export const carrierRequestDurationMs = () =>
  meter().createHistogram("carrier_request_duration_ms", {
    description: "Outbound carrier API latency",
    unit: "ms",
  });

export const webhookDeliveriesTotal = () =>
  meter().createCounter("webhook_deliveries_total", { description: "Outbound webhook delivery attempts" });

export const reconciliationDisputesOpenedTotal = () =>
  meter().createCounter("reconciliation_disputes_opened_total", {
    description: "Reconciliation disputes opened",
  });
