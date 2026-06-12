import { test, expect } from "@playwright/test";
import { AB_CODE, gotoWorkbench, setEditor, setStdin } from "./helpers";

/**
 * (2) Type a simple A+B program, feed it custom stdin in the Run panel, click
 * Run, and assert an OK verdict with the expected stdout and exit code 0. This
 * hits the real /api/run route, so it validates macOS clang compilation,
 * Node-measured timing and the verdict logic end to end.
 */
test("compiles and runs A+B against custom stdin", async ({ page }) => {
  await gotoWorkbench(page);

  await setEditor(page, AB_CODE);
  // Custom stdin distinct from the default (2 3) to prove it is actually used.
  await setStdin(page, "10 20\n");

  await page.getByTestId("run-button").click();

  // First compile of the session is slow (clang instantiates <bits/stdc++.h>).
  const verdict = page.getByTestId("run-verdict");
  await expect(verdict).toHaveAttribute("data-verdict", "OK", {
    timeout: 120_000,
  });

  // Program output and exit code surface in the metrics row + raw terminal log.
  await expect(page.getByTestId("terminal-output")).toContainText("30");
  await expect(page.getByTestId("run-metrics")).toContainText(/exit\s*0/);
  await expect(page.getByTestId("elapsed-time")).toBeVisible();
});
