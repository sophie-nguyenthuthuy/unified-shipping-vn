import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@usv/core",
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
