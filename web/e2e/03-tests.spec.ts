import { test, expect } from "@playwright/test";
import { AB_CODE, gotoWorkbench, setEditor } from "./helpers";

/**
 * (3) In the Tests panel keep one correct (AC) case and add a deliberately
 * wrong (WA) case, Run all, and assert the per-case badges plus a visible diff
 * on the failing case. Drives the real /api/test route.
 */
test("grades AC and WA cases with a diff on the failure", async ({ page }) => {
  await gotoWorkbench(page);

  await setEditor(page, AB_CODE);
  await page.getByTestId("tab-tests").click();

  // Case 0: correct -> AC.
  await page.getByTestId("test-input-0").fill("2 3\n");
  await page.getByTestId("test-expected-0").fill("5\n");

  // Case 1: wrong expected output -> WA (actual 30 vs expected 999).
  await page.getByTestId("add-test-button").click();
  await page.getByTestId("test-input-1").fill("10 20\n");
  await page.getByTestId("test-expected-1").fill("999\n");

  await page.getByTestId("run-all-button").click();

  // Summary appears once compilation + all cases finish.
  await expect(page.getByTestId("tests-summary")).toBeVisible({
    timeout: 120_000,
  });

  await expect(page.getByTestId("verdict-badge-0")).toHaveAttribute(
    "data-verdict",
    "AC",
  );
  await expect(page.getByTestId("verdict-badge-1")).toHaveAttribute(
    "data-verdict",
    "WA",
  );

  // The failing case auto-expands and shows an expected-vs-actual diff.
  await expect(page.getByTestId("diff-view-1")).toBeVisible();
  await expect(page.getByTestId("diff-view-1")).toContainText("999");
  await expect(page.getByTestId("diff-view-1")).toContainText("30");

  // Overall summary verdict is the worst case (WA).
  await expect(page.getByTestId("tests-verdict")).toHaveAttribute(
    "data-verdict",
    "WA",
  );
});
