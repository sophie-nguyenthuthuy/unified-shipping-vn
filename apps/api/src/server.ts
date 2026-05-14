import { loadEnv } from "@usv/config";
import { startTelemetry } from "@usv/observability";

import { buildServer } from "./app.js";

const main = async (): Promise<void> => {
  const env = loadEnv();
  const shutdownTelemetry = await startTelemetry(process.env.OTEL_SERVICE_NAME ?? "usv-api");

  const app = await buildServer({ env });

  const close = async () => {
    app.log.info("shutdown requested");
    try {
      await app.close();
      await shutdownTelemetry();
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  try {
    await app.listen({ host: "0.0.0.0", port: env.PORT });
  } catch (err: unknown) {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
};

main().catch((err: unknown) => {
  console.error("fatal:", err);
  process.exit(1);
});
