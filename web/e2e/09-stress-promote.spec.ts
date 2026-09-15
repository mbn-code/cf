import { test, expect } from "@playwright/test";
import { gotoWorkbench, setEditor } from "./helpers";

// Off by one for large sums so the generator (0..1000) trips it quickly.
const BUGGY = `#include <bits/stdc++.h>
using namespace std;
int main() { long long a, b; cin >> a >> b; cout << (a + b > 1500 ? a + b - 1 : a + b) << "\\n"; }
`;

/**
 * (9) Stress finds a counter-example for a buggy solution and the failing
 * input can be promoted straight into a test case (expected = brute output)
 * and into the Run panel's stdin.
 */
test("stress finds a counter-example and promotes it to a test case", async ({
  page,
}) => {
  await gotoWorkbench(page);
  await setEditor(page, BUGGY);

  await page.getByTestId("tab-stress").click();
  await page.getByTestId("stress-iterations").fill("400");
  await page.getByTestId("stress-run-button").click();

  const failure = page.getByTestId("stress-failure");
  await expect(failure).toBeVisible({ timeout: 150_000 });
  await expect(failure).toContainText("mismatch");
  await expect(page.getByTestId("stress-diff")).toBeVisible();

  const input = (
    await page.getByTestId("stress-failure-input").innerText()
  ).trim();
  expect(input).toMatch(/^\d+ \d+$/);

  await page.getByTestId("stress-add-test").click();
  await expect(page.getByTestId("tests-panel")).toBeVisible();
  await expect(page.getByTestId("test-input-1")).toHaveValue(
    new RegExp(`^${input}\\s*$`),
  );
  const expected = await page.getByTestId("test-expected-1").inputValue();
  const [a, b] = input.split(" ").map(Number);
  expect(Number(expected.trim())).toBe(a + b);

  await page.getByTestId("tab-stress").click();
  await page.getByTestId("stress-use-stdin").click();
  await expect(page.getByTestId("run-stdin")).toHaveValue(
    new RegExp(`^${input}\\s*$`),
  );
});
