import { trace, type Span, SpanStatusCode } from "@opentelemetry/api";

const TRACER_NAME = "@usv/observability";

export const tracer = () => trace.getTracer(TRACER_NAME);

export const withSpan = async <T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs: Record<string, string | number | boolean> = {},
): Promise<T> => {
  const span = tracer().startSpan(name, { attributes: attrs });
  try {
    return await fn(span);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    throw err;
  } finally {
    span.end();
  }
};

/**
 * Bootstraps the OpenTelemetry Node SDK. Call once at process start, before
 * importing modules that should be auto-instrumented. The exporter respects
 * standard OTEL_EXPORTER_OTLP_* env vars.
 */
export const startTelemetry = async (serviceName: string): Promise<() => Promise<void>> => {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return async () => {};
  }
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { Resource } = await import("@opentelemetry/resources");
  const { SemanticResourceAttributes } = await import("@opentelemetry/semantic-conventions");

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
  });
  sdk.start();
  return () => sdk.shutdown();
};
