import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright harness for the cf workbench end-to-end tests.
 *
 * The specs under ./e2e drive the REAL Next.js app against the REAL C++
 * toolchain (no network mocking): every Run / Run-all / Stress action hits the
 * actual /api/* routes, which compile and execute C++ in a tmp sandbox. The
 * webServer builds the app and serves it on a fixed port so the suite exercises
 * a production build end to end.
 *
 * Timeouts are deliberately generous: the very first request of a session pays
 * for clang instantiating <bits/stdc++.h>, and several specs compile three
 * sources (stress) on top of that.
 */
export default defineConfig({
  testDir: "./e2e",
  // The C++ engine shares a single problems store and is CPU-heavy; a single
  // worker with no in-file parallelism keeps cases from contending for cores
  // and keeps timing deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Per-test budget. First-run compilation (and three-source stress compiles)
  // can take tens of seconds on a cold machine.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // A real production build + server so the e2e proves the shipped artifact.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    // Locally we reuse a server you already have running; CI always builds fresh.
    reuseExistingServer: !process.env.CI,
    // `next build` from cold can take a couple of minutes on first run.
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
