# Feature guide

This is a tour of the browser workbench (`web/app/page.tsx` and the components under
`web/components/`). Every feature listed here is implemented in the shipped UI.

The workbench is a single page with three regions:

- a collapsible **Problems sidebar** on the left,
- the **editor** with its toolbar in the center, and
- a tabbed **panel** area (Run, Tests, Stress, Settings).

A clean dark theme is fixed (the page renders with `<html className="dark">`).

---

## Editor

- **Syntax highlighting** for C++ via Prism, rendered behind a transparent
  `<textarea>` (`react-simple-code-editor`).
- **Line-number gutter** kept in sync with the editor's scroll position.
- **Soft tabs**: pressing Tab inserts four spaces rather than moving focus.
- **Adjustable font size** from the toolbar (range 10-24 px, default 14 px). Use the
  font decrease / increase controls; the size is remembered across reloads.
- **Persistence**: editor contents are written to `localStorage` under the key
  `cf:code` on every change and restored on load.

The editor opens with `DEFAULT_CODE` (defined in `web/lib/templates.ts`): an A + B
program that reads two integers from stdin and prints their sum. It compiles against
the bundled `<bits/stdc++.h>` shim out of the box.

### Templates

The toolbar's template selector inserts one of these starter programs (from
`web/lib/templates.ts`):

| Template           | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Minimal            | Bare `main` with fast-I/O wiring.                                |
| A + B              | Read two integers, print their sum (the default program).        |
| Fast I/O + helpers | Typedefs, macros, and a multi-test-case scaffold.                |
| Brute force        | A reference-solution scaffold for stress testing.                |
| Generator          | A seeded random input generator (the seed arrives as `argv[1]`). |

The Brute force and Generator templates also seed the Stress panel's editors.

---

## Run panel

The Run panel sends the current editor contents to `POST /api/run` with the stdin
you provide. It renders:

- a **verdict** badge: `OK`, `CE` (compile error), `RE` (runtime error), or `TLE`
  (time-limit exceeded);
- run **metrics**: exit code, elapsed wall-clock time (measured server-side in Node),
  the detected compiler, and compile time;
- a **scrollable raw terminal log** combining stdout, stderr, and compile diagnostics.
  The log auto-scrolls to the newest output but lets you scroll back through history.

Set custom input in the stdin field (it defaults to `2 3`). Press **Run** or use the
`Cmd/Ctrl+Enter` shortcut.

---

## Tests panel

The Tests panel runs the current code against many sample cases through
`POST /api/test`. The code is compiled once and reused for every case.

- **Add / edit / delete** cases. Each case has an input and an expected output.
- **Paste and split**: paste a block of text and split it into input / expected on a
  separator (a line of `---` or `===`, or a blank line), which is handy for pasting a
  problem's sample block.
- **Run all** compiles once, runs each case, and shows a per-case badge:
  - `AC` accepted (output matches),
  - `WA` wrong answer (output differs),
  - `TLE` time-limit exceeded,
  - `RE` runtime error (non-zero exit or killed by a signal),
  - `CE` compile error (reported on every case when compilation fails).
- **Diff view**: a failing case expands to a per-line diff of expected vs actual.
  Comparison is tolerant of trailing whitespace and trailing blank lines, so a stray
  newline never causes a spurious `WA`.
- A **summary** reports totals and the worst verdict across all cases.

The default workspace ships with one case, `2 3` expecting `5`.

---

## Stress panel

The Stress panel finds counter-examples by comparing your solution against a brute
force on randomly generated inputs. It POSTs to `/api/stress` with three C++ sources
and an iteration count:

- **Solution**: the candidate you want to verify (the editor's current code).
- **Brute force**: a simple, obviously correct reference.
- **Generator**: a program that prints a random test case; the harness passes the
  iteration seed as `argv[1]` so runs are reproducible.

The harness compiles all three, then loops: generate an input, feed it to both the
solution and the brute force, and compare their outputs. It reports the **first
failing input** along with the reason:

- `mismatch` the two outputs differ,
- `solution-error` / `brute-error` a program exited non-zero or crashed,
- `solution-tle` / `brute-tle` a program exceeded the time limit,
- `generator-error` the generator itself failed.

Iterations default to 100 (maximum 5000), and the whole request is bounded by a
30-second deadline so a slow brute force cannot hang the page. If the `/api/stress`
endpoint is unavailable, the panel shows a graceful "endpoint not available" notice
instead of erroring.

---

## Problems sidebar

The sidebar manages saved problems through `/api/problems`. Each problem bundles a
name, the solution code, an optional statement, and its test cases, stored as a JSON
file under `web/data/problems/`.

- **Save** the current workspace under a name (`Cmd/Ctrl+S`, when a name is set).
- **Load** a saved problem back into the editor and Tests panel.
- **Rename** a problem (the on-disk slug is recomputed from the new name).
- **Delete** a problem with a confirmation step.

The active problem is remembered across reloads via `localStorage`.

---

## Settings

The Settings tab controls how every request is compiled and run:

| Setting              | Default   | Notes                                                          |
| -------------------- | --------- | -------------------------------------------------------------- |
| Language standard    | `gnu++17` | Choose from `gnu++17`, `gnu++20`, `gnu++23`, `c++17`, `c++20`. |
| Time limit           | 5000 ms   | Per execution; clamped server-side to 100-60000 ms.            |
| Extra compiler flags | none      | Whitespace-separated flags appended to the compile command.    |
| Font size            | 14 px     | Editor font, range 10-24 px.                                   |

These settings are sent on every Run, Run all, and Stress request.

---

## Keyboard shortcuts

| Shortcut               | Action                                              |
| ---------------------- | --------------------------------------------------- |
| `Cmd/Ctrl+Enter`       | Run the current code in the Run panel.              |
| `Cmd/Ctrl+Shift+Enter` | Run all test cases.                                 |
| `Cmd/Ctrl+S`           | Save the current problem (when a save name is set). |

---

## What persists across reloads

The workbench stores UI state in `localStorage` (keys defined in
`web/lib/storage.ts`). Persisted state is restored on the next load:

| Key                | Holds                                          |
| ------------------ | ---------------------------------------------- |
| `cf:code`          | Editor contents.                               |
| `cf:settings`      | Language standard, time limit, compiler flags. |
| `cf:tests`         | Sample test cases.                             |
| `cf:stress`        | Stress panel sources and iteration count.      |
| `cf:activeProblem` | The currently loaded problem slug.             |
| `cf:fontSize`      | Editor font size.                              |

All `localStorage` access is guarded, so the app renders correctly on the server and
simply skips persistence if storage is unavailable.
