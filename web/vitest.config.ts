import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit tests for the execution engine and the client-side helpers. They run
 * in Node against the real C++ toolchain where a compiler is available; the
 * Playwright suite under ./e2e is separate and is NOT picked up here.
 */
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "lib/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: process.env.CI ? ["dot"] : ["default"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
