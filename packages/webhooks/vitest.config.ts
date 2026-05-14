import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "@usv/webhooks", include: ["test/**/*.test.ts"], environment: "node" },
});
