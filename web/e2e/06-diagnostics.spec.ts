import { test, expect } from "@playwright/test";
import { gotoWorkbench, setEditor } from "./helpers";

/**
 * (6) A compile error produces a CE verdict, a clickable diagnostics list
 * with the failing line, a gutter marker on that line, and an error count in
 * the editor toolbar. Clicking the diagnostic moves the caret to the line.
 */
test("surfaces compiler diagnostics with line markers", async ({ page }) => {
  await gotoWorkbench(page);

  await setEditor(
    page,
    "#include <bits/stdc++.h>\nint main() {\n    int x = y;\n    return 0;\n}\n",
  );
  await page.getByTestId("run-button").click();

  await expect(page.getByTestId("run-verdict")).toHaveAttribute(
    "data-verdict",
    "CE",
    { timeout: 120_000 },
  );

  const diagnostics = page.getByTestId("diagnostics-list");
  await expect(diagnostics).toBeVisible();
  await expect(
    diagnostics.locator("li[data-severity='error']").first(),
  ).toContainText(/y/);

  // Line 3 carries an error marker in the gutter.
  const gutter = page.getByTestId("code-editor-gutter");
  await expect(gutter.locator("[data-marker='error']")).toHaveCount(1);
  await expect(gutter.locator("[data-marker='error']")).toHaveText("3");

  // gcc and clang disagree on how many errors one undeclared name produces.
  await expect(page.getByTestId("error-count")).toContainText(/\d+ errors?/);

  // Clicking the diagnostic jumps the caret to line 3.
  await diagnostics.getByRole("button").first().click();
  await expect(page.getByTestId("editor-status")).toContainText("Ln 3");

  // Fixing the code clears the stale verdict and the markers.
  await setEditor(
    page,
    "#include <bits/stdc++.h>\nint main() {\n    int y = 1, x = y;\n    return x - 1;\n}\n",
  );
  await expect(gutter.locator("[data-marker='error']")).toHaveCount(0);
  await expect(page.getByTestId("run-verdict")).toHaveCount(0);
});
