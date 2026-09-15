import { test, expect } from "@playwright/test";
import { gotoWorkbench, setEditor } from "./helpers";

const STATEMENT = `A. Team
time limit per test
2 seconds
memory limit per test
256 megabytes

Help the friends find the number of problems for which they will write a solution.
Input
The first input line contains a single integer n.
Output
Print a single integer.
Examples
Input
Copy

3
1 1 0
1 1 1
1 0 0

Output
Copy

2

Input
Copy

2
1 0 0
0 1 1

Output
Copy

1

Note
In the first sample Petya and Vasya are sure.
`;

const TEAM_CODE = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, ans = 0; cin >> n;
    while (n--) { int a, b, c; cin >> a >> b >> c; ans += (a + b + c) >= 2; }
    cout << ans << "\\n";
}
`;

/**
 * (7) Paste a Codeforces statement into the Tests panel: every Input/Output
 * pair becomes a test case, the time limit is applied to Settings, the title
 * pre-fills the save name, and running all cases yields AC.
 */
test("imports samples and limits from a pasted statement", async ({ page }) => {
  await gotoWorkbench(page);
  await setEditor(page, TEAM_CODE);

  await page.getByTestId("tab-tests").click();
  await page.getByTestId("import-statement-button").click();
  await page.getByTestId("import-statement-text").fill(STATEMENT);
  await page.getByTestId("import-statement-submit").click();

  // The default A+B case is replaced by the two parsed samples.
  await expect(page.getByTestId("test-case-1")).toBeVisible();
  await expect(page.getByTestId("test-case-2")).toHaveCount(0);
  await expect(page.getByTestId("test-input-0")).toHaveValue(
    "3\n1 1 0\n1 1 1\n1 0 0\n",
  );
  await expect(page.getByTestId("test-expected-1")).toHaveValue("1\n");

  // The title pre-fills the save name and the time limit reaches Settings.
  await expect(page.getByTestId("save-problem-name")).toHaveValue("A. Team");
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-time-limit")).toHaveValue("2000");

  await page.getByTestId("tab-tests").click();
  await page.getByTestId("run-all-button").click();
  await expect(page.getByTestId("tests-verdict")).toHaveAttribute(
    "data-verdict",
    "AC",
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("tests-summary")).toContainText("2/2 passed");
});
