import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { name: "@usv/crypto", include: ["test/**/*.test.ts"], environment: "node" },
});
