import { test, expect } from "@playwright/test";
import { gotoWorkbench } from "./helpers";

/**
 * (5) Insert a template and verify that the editor contents, font size and
 * settings survive a full reload via localStorage.
 */
test("persists inserted template, font size and settings across reload", async ({
  page,
}) => {
  await gotoWorkbench(page);

  // Insert the "Fast I/O + helpers" template (id "fast-io"); it contains a
  // distinctive `void solve()` scaffold absent from the default A+B source.
  await page.getByTestId("template-select").selectOption("fast-io");
  await expect(page.getByTestId("code-editor")).toHaveValue(/void solve\(\)/);

  // Bump the editor font size 14 -> 16.
  await page.getByTestId("font-increase").click();
  await page.getByTestId("font-increase").click();

  // Change the language standard in Settings.
  await page.getByTestId("tab-settings").click();
  await page.getByTestId("settings-std").selectOption("c++20");

  // Confirm everything was written to localStorage before reloading.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cf:fontSize")))
    .toBe("16");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cf:code")))
    .toContain("void solve()");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cf:settings")))
    .toContain("c++20");

  await page.reload();
  await expect(page.getByTestId("code-editor")).toBeVisible();

  // State survived the reload, hydrated back into the UI.
  await expect(page.getByTestId("code-editor")).toHaveValue(/void solve\(\)/);

  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-std")).toHaveValue("c++20");
  await expect(page.getByTestId("settings-font-size")).toHaveValue("16");
});
