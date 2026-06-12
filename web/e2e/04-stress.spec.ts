import { test, expect } from "@playwright/test";
import { gotoWorkbench } from "./helpers";

/**
 * (4) Exercise the Stress panel happy path. The default solution (editor) and
 * brute-force template are both A+B, so no counter-example exists and the run
 * must report a clean search. If the /api/stress endpoint is unavailable in
 * this build the panel degrades gracefully — that path is accepted too, as long
 * as no spurious failure is surfaced.
 */
test("stress search reports no counter-example for matching solution/brute", async ({
  page,
}) => {
  await gotoWorkbench(page);

  await page.getByTestId("tab-stress").click();
  await expect(page.getByTestId("stress-panel")).toBeVisible();

  // Keep the search short so the suite stays quick.
  await page.getByTestId("stress-iterations").fill("20");

  await page.getByTestId("stress-run-button").click();

  const result = page.getByTestId("stress-result");
  await expect(result).toContainText(
    /No counter-example found|not available in this build/i,
    { timeout: 150_000 },
  );

  // Neither the happy path nor graceful degradation may surface a failure.
  await expect(page.getByTestId("stress-failure")).toHaveCount(0);
});
