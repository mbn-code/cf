import { expect, type Page } from "@playwright/test";

/**
 * Shared fixtures for the workbench e2e suite.
 *
 * Selectors mirror the stable `data-testid` hooks the consolidated UI exposes
 * (see web/components/**). Verdict pills carry a `data-verdict` attribute with
 * the raw code (OK/AC/WA/...), which is what we assert against.
 */

/** A minimal, obviously-correct A+B program that uses <bits/stdc++.h>. */
export const AB_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
`;

/** Navigate to the workbench and wait for the client-side editor to mount. */
export async function gotoWorkbench(page: Page): Promise<void> {
  await page.goto("/");
  // The editor (and the rest of the client tree) only renders after mount;
  // the placeholder "Loading editor…" is swapped for the real textarea.
  await expect(page.getByTestId("code-editor")).toBeVisible();
}

/**
 * Replace the C++ source in the main editor. The editor is a controlled
 * <textarea> (react-simple-code-editor), so a plain fill drives its onChange.
 */
export async function setEditor(page: Page, code: string): Promise<void> {
  const editor = page.getByTestId("code-editor");
  await editor.fill(code);
  await expect(editor).toHaveValue(code);
}

/** Set the custom stdin fed to the program on Run. */
export async function setStdin(page: Page, input: string): Promise<void> {
  await page.getByTestId("run-stdin").fill(input);
}
