import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "@usv/reconciliation", include: ["test/**/*.test.ts"], environment: "node" },
});
