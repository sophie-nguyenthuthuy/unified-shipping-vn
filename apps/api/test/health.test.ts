import { describe, expect, it } from "vitest";

/**
 * Placeholder unit-test entry. End-to-end tests live in `test/integration/`
 * and require Postgres + Redis (see `pnpm test:integration`).
 */
describe("api smoke", () => {
  it("module imports without throwing", async () => {
    const mod = await import("../src/plugins/request-id.js");
    expect(typeof mod.requestIdPlugin).toBe("function");
  });
});
