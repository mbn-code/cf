import { test, expect } from "@playwright/test";
import { gotoWorkbench, setEditor, setStdin } from "./helpers";

const CODE = `#include <bits/stdc++.h>
int main() { int n; std::cin >> n; std::cout << n * n << "\\n"; }
`;

/**
 * (10) The problems library persists the whole workspace: source, tests,
 * stdin and settings. Saving, resetting to a new workspace and loading again
 * restores everything; the dirty indicator tracks unsaved edits; rename,
 * duplicate and delete round-trip through /api/problems.
 */
test("saves, reloads, duplicates and deletes a whole workspace", async ({
  page,
}) => {
  const name = `e2e-lib-${Date.now()}`;
  await gotoWorkbench(page);

  await setEditor(page, CODE);
  await setStdin(page, "7\n");
  await page.getByTestId("tab-tests").click();
  await page.getByTestId("test-input-0").fill("4\n");
  await page.getByTestId("test-expected-0").fill("16\n");
  await page.getByTestId("tab-settings").click();
  await page.getByTestId("settings-std").selectOption("gnu++20");

  await page.getByTestId("save-problem-name").fill(name);
  await page.getByTestId("save-problem-button").click();
  await expect(page.getByTestId("active-problem")).toContainText(name);
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);

  // Editing marks the workspace dirty; saving clears it.
  await page.getByTestId("tab-run").click();
  await setStdin(page, "8\n");
  await expect(page.getByTestId("dirty-indicator")).toBeVisible();
  await page.getByTestId("save-problem-button").click();
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0);

  // New workspace resets everything, loading brings it all back.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("new-workspace-button").click();
  await expect(page.getByTestId("active-problem")).toHaveCount(0);
  await expect(page.getByTestId("run-stdin")).toHaveValue("2 3\n");

  await page.getByTestId(`load-problem-${name}`).click();
  await expect(page.getByTestId("active-problem")).toContainText(name);
  await expect(page.getByTestId("code-editor")).toHaveValue(/n \* n/);
  await expect(page.getByTestId("run-stdin")).toHaveValue("8\n");
  await page.getByTestId("tab-tests").click();
  await expect(page.getByTestId("test-expected-0")).toHaveValue("16\n");
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-std")).toHaveValue("gnu++20");

  // Duplicate, then delete both.
  const item = page.getByTestId(`problem-item-${name}`);
  await item.hover();
  await page.getByTestId(`duplicate-problem-${name}`).click();
  await page.getByTestId(`confirm-name-${name}`).click();
  await expect(page.getByTestId(`problem-item-${name}-copy`)).toBeVisible();

  for (const slug of [`${name}-copy`, name]) {
    await page.getByTestId(`problem-item-${slug}`).hover();
    await page.getByTestId(`delete-problem-${slug}`).click();
    await page.getByTestId(`confirm-delete-${slug}`).click();
    await expect(page.getByTestId(`problem-item-${slug}`)).toHaveCount(0);
  }
});
