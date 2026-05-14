import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  API_KEY_PEPPER: z.string().min(32),

  API_PUBLIC_URL: z.string().url(),
  DASHBOARD_PUBLIC_URL: z.string().url(),

  RATE_LIMIT_DEFAULT_RPM: z.coerce.number().int().positive().default(600),

  USV_KMS_PROVIDER: z.enum(["local", "aws-kms"]).default("local"),
  USV_KMS_DEFAULT_KEY_ID: z.string().min(1),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("usv"),
  SENTRY_DSN: z.string().url().optional(),
});
export type Env = z.infer<typeof Env>;

export const loadEnv = (raw: NodeJS.ProcessEnv = process.env): Env => {
  const result = Env.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
};
