import { test, expect } from "@playwright/test";
import { gotoWorkbench, setEditor } from "./helpers";

const ONE_PER_LINE = `#include <bits/stdc++.h>
int main() { std::puts("1\\n2\\n3"); }
`;

/**
 * (8) The output checker: under the default "lines" checker an answer whose
 * tokens match but whose layout differs is WA with a whitespace-only hint;
 * switching Settings to the "tokens" checker makes the same case AC.
 */
test("tokens checker accepts a whitespace-only difference", async ({
  page,
}) => {
  await gotoWorkbench(page);
  await setEditor(page, ONE_PER_LINE);

  await page.getByTestId("tab-tests").click();
  await page.getByTestId("test-input-0").fill("x\n");
  await page.getByTestId("test-expected-0").fill("1 2 3\n");

  await page.getByTestId("run-all-button").click();
  await expect(page.getByTestId("verdict-badge-0")).toHaveAttribute(
    "data-verdict",
    "WA",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("presentation-hint-0")).toBeVisible();

  await page.getByTestId("tab-settings").click();
  await page.getByTestId("settings-checker").selectOption("tokens");
  await expect(page.getByTestId("editor-status")).toContainText("tokens");

  await page.getByTestId("tab-tests").click();
  await page.getByTestId("run-all-button").click();
  await expect(page.getByTestId("verdict-badge-0")).toHaveAttribute(
    "data-verdict",
    "AC",
    { timeout: 120_000 },
  );

  // The second run reuses the cached binary.
  await expect(page.getByTestId("tests-summary")).toBeVisible();
});

test("run-one grades a single case and disallowed flags are reported", async ({
  page,
}) => {
  await gotoWorkbench(page);

  await page.getByTestId("tab-settings").click();
  await page.getByTestId("settings-flags").fill("-Wall -o /tmp/evil");

  await page.getByTestId("tab-tests").click();
  await page.getByTestId("add-test-button").click();
  await page.getByTestId("test-input-1").fill("10 20\n");
  await page.getByTestId("test-expected-1").fill("30\n");

  await page.getByTestId("run-test-1").click();
  await expect(page.getByTestId("verdict-badge-1")).toHaveAttribute(
    "data-verdict",
    "AC",
    { timeout: 120_000 },
  );
  // Only the case that was run has a verdict.
  await expect(page.getByTestId("verdict-badge-0")).toHaveCount(0);
  await expect(page.getByTestId("rejected-flags")).toContainText("-o");
});
