import { test, expect } from "@playwright/test";
import { gotoWorkbench } from "./helpers";

/**
 * (1) Load the workbench and confirm the core panels render and every tab is
 * reachable. No compilation here — this is the fast structural smoke test.
 */
test("loads the workbench with all core panels reachable", async ({ page }) => {
  await gotoWorkbench(page);

  // Top-level chrome.
  await expect(page.getByTestId("run-button")).toBeVisible();
  await expect(page.getByTestId("code-editor")).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Workbench panels" }),
  ).toBeVisible();
  await expect(page.getByTestId("problems-sidebar")).toBeVisible();

  // The Run panel is active by default.
  await expect(page.getByTestId("run-panel")).toBeVisible();
  await expect(page.getByTestId("run-stdin")).toBeVisible();

  // Each tab reveals exactly its own panel.
  await page.getByTestId("tab-tests").click();
  await expect(page.getByTestId("tests-panel")).toBeVisible();

  await page.getByTestId("tab-stress").click();
  await expect(page.getByTestId("stress-panel")).toBeVisible();

  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();

  // Editor toolbar affordances exist.
  await expect(page.getByTestId("template-select")).toBeVisible();
});
