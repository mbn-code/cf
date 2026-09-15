# Feature guide

This is a tour of the browser workbench (`web/app/page.tsx` and the components
under `web/components/`) followed by the command-line tool (`scripts/cf`).
Every feature listed here is implemented and covered by the unit, CLI or
Playwright suites.

The workbench is a single page with three regions:

- a collapsible **Problems sidebar** on the left,
- the **editor** with its toolbar and status bar in the center, and
- a tabbed, resizable **panel** area (Run, Tests, Stress, Settings).

A dark theme is fixed (the page renders with `<html className="dark">`).

---

## Editor

- **Syntax highlighting** for C++ via Prism, rendered behind a transparent
  `<textarea>` (`react-simple-code-editor`).
- **Line-number gutter** with **error and warning markers**: after a compile,
  lines that produced a diagnostic get a red (error) or amber (warning) dot and
  a tinted background. Markers clear as soon as the source changes.
- **Soft tabs**: Tab inserts four spaces rather than moving focus.
- **`Ctrl/Cmd+/`** toggles `// ` on the current line or selection.
- **Status bar** with the caret position (`Ln`, `Col`), line and character
  counts, and the active time limit, checker and extra flags.
- **Adjustable font size** (10-24 px, default 14) from the toolbar or Settings.
- **Persistence**: editor contents are written to `localStorage` under
  `cf:code` on every change and restored on load.
- The toolbar shows the language standard and, after a compile, the number of
  errors or warnings.

The editor opens with `DEFAULT_CODE` (in `web/lib/templates.ts`): an A + B
program that reads two integers from stdin and prints their sum. It compiles
against the bundled `<bits/stdc++.h>` shim out of the box.

### Templates

The toolbar's template selector inserts one of these starter programs:

| Template           | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Minimal            | Bare `main` with fast-I/O wiring.                                |
| A + B              | Read two integers, print their sum (the default program).        |
| Fast I/O + helpers | Typedefs, macros, and a multi-test-case scaffold.                |
| Brute force        | A reference-solution scaffold for stress testing.                |
| Generator          | A seeded random input generator (the seed arrives as `argv[1]`). |

The Brute force and Generator templates also seed the Stress panel's editors.
The repository's `templates/` directory (dp, graph, math) is available to the
CLI through `cf template --from` and to tools through `GET /api/template`.

---

## Run panel

The Run panel sends the current editor contents to `POST /api/run` with the
stdin you provide. It renders:

- a **verdict** badge: `OK`, `CE` (compile error), `RE` (runtime error) or
  `TLE` (time-limit exceeded);
- run **metrics**: exit code (or the terminating signal), elapsed wall-clock
  time measured server-side in Node, compile time or a `cached` marker when
  the binary came from the compile cache, and the detected compiler;
- warning and error counts, plus `timed out` / `output truncated` flags;
- a **diagnostics list** parsed from the compiler output. Entries with a
  location are buttons: click one and the editor jumps to that line;
- a notice listing any **ignored compiler flags** and why they were rejected;
- a **scrollable raw terminal log** combining stdout, stderr and compiler
  output. The log auto-scrolls to the newest output but lets you scroll back.
- **Copy** the raw log and **Clear** the result.

The stdin field defaults to `2 3` and is remembered across reloads. Press
**Run** or use `Ctrl/Cmd+Enter`.

---

## Tests panel

The Tests panel runs the current code against many sample cases through
`POST /api/test`. The code is compiled once (or served from the cache) and
reused for every case.

- **Add / edit / duplicate / delete** cases. Each case has an input and an
  expected output; the field header shows the line count.
- **Paste split**: paste a block of text and split it into input / expected
  on a separator (a line of `---` or `===`, or a blank line).
- **From statement**: paste a whole Codeforces problem statement. Every
  `Input` / `Output` pair under `Examples` becomes a test case (replacing the
  default case, or appended when you already have real cases). The
  statement's time limit is applied to Settings, its title pre-fills the save
  name, and the first sample becomes the Run panel's stdin when that is still
  the default. AtCoder-style `Sample Input N` headings are understood too.
- **Run all** compiles once, runs each case, and shows a per-case badge:
  - `AC` accepted (output matches under the active checker),
  - `WA` wrong answer (output differs),
  - `TLE` time-limit exceeded,
  - `RE` runtime error (non-zero exit or killed by a signal),
  - `CE` compile error (reported on every case when compilation fails),
  - `SKIP` not run because **Stop on fail** was enabled and an earlier case
    failed.
- **Run one** (the play button on a case) grades just that case and merges the
  result into the existing verdicts.
- **Use as stdin** copies a case's input to the Run panel.
- **Diff view**: a failing case expands to a per-line diff of expected vs
  actual. A `WA` whose tokens match but whose whitespace layout differs is
  marked **whitespace only**; switch the checker to Tokens if the judge
  accepts any layout.
- **Expand all / collapse all**, and a **summary** with the worst verdict,
  passed count and the slowest case.

The default workspace ships with one case, `2 3` expecting `5`.

---

## Stress panel

The Stress panel finds counter-examples by comparing your solution against a
brute force on randomly generated inputs. It POSTs to `/api/stress` with
three C++ sources, an iteration count and a seed base:

- **Solution**: the candidate you want to verify (the editor's current code).
- **Brute force**: a simple, obviously correct reference.
- **Generator**: a program that prints a random test case; the harness passes
  the iteration seed (`seed base + i`) as `argv[1]` so runs are reproducible.

The harness compiles all three (using the compile cache), then loops:
generate an input, feed it to both the solution and the brute force, and
compare their outputs under the active checker. It reports the **first
failing input** along with the reason:

- `mismatch` the two outputs differ,
- `solution-error` / `brute-error` a program exited non-zero or crashed,
- `solution-tle` / `brute-tle` a program exceeded the time limit,
- `generator-error` the generator itself failed.

For a failure, **Add as test** appends the input as a test case with the
brute force's output as the expected answer, and **Use as stdin** sends it to
the Run panel. A clean run shows iteration count, total elapsed time and the
maximum and average solution time.

Iterations default to 100 (maximum 5000), and the whole request is bounded by
a 60-second deadline so a slow brute force cannot hang the page; the result
says when the budget cut the search short. If the `/api/stress` endpoint is
unavailable, the panel shows a graceful notice instead of erroring.

---

## Problems sidebar

The sidebar manages saved problems through `/api/problems`. Each problem is
a complete workspace: name, source, statement, test cases, the custom stdin,
the brute-force and generator sources and the run settings, stored as one
JSON file under `web/data/problems/`.

- **Save** the current workspace under a name (`Ctrl/Cmd+S`, when a name is
  set). An amber dot on the save button and next to the active problem name
  marks unsaved changes.
- **Load** a saved problem back into every panel.
- **Rename** (the on-disk slug is recomputed), **duplicate** under a new name,
  and **delete** with a confirmation step.
- **Filter** the list once it has more than a handful of entries; each row
  shows the test count and when it was last updated.
- **New workspace** resets the editor, tests, stdin and stress sources
  (asking first when there are unsaved changes).
- **Export** downloads the whole library as one JSON bundle; **Import** reads
  such a bundle back, skipping problems that already exist.

The active problem is remembered across reloads via `localStorage`, and the
sidebar can be collapsed with `Ctrl/Cmd+B`.

---

## Settings

The Settings tab controls how every request is compiled and run:

| Setting              | Default   | Notes                                                                               |
| -------------------- | --------- | ----------------------------------------------------------------------------------- |
| Language standard    | `gnu++17` | `gnu++17`, `gnu++20`, `gnu++23`, `c++17`, `c++20`, `c++23`.                         |
| Time limit           | 5000 ms   | Per execution; clamped server-side to 100-60000 ms.                                 |
| Output checker       | Lines     | Lines (exact, trailing whitespace ignored), Tokens (whitespace-insensitive), Float. |
| Float epsilon        | `1e-6`    | Shown for the Float checker; `                                                      | a-b | <= eps`or` | a-b | <= eps * max(1, | b   | )`. |
| Extra compiler flags | none      | Space-separated; validated against an allowlist (see below).                        |
| Font size            | 14 px     | Editor font, range 10-24 px.                                                        |

Below the settings, **Reset to defaults** and **Clear compile cache** act
immediately, and a read-only **Server** block shows the workbench version,
the compiler version, the platform, the include directory, the size limits
and how many binaries are cached.

### Allowed compiler flags

Flags reach the compiler command line, so only the families a competitive
programmer needs are forwarded: `-O*`, `-W*`, `-w`, `-D*`, `-U*`, `-f*`,
`-g*`, `-m*`, `-std=<known standard>`, `-pedantic`, `-static`, `-pthread`,
`-pipe`. Flags that write files or load code (`-o`, `-I`, `-L`, `-l`,
`-include`, `@file`, `-fplugin*`, `-fprofile*`, `-Wl,`, `-Wa,`, `-Wp,`) and
anything containing shell metacharacters are dropped, and the Run and Tests
panels list what was ignored and why.

---

## Keyboard shortcuts

| Shortcut               | Action                                                  |
| ---------------------- | ------------------------------------------------------- |
| `Ctrl/Cmd+Enter`       | Run the current code in the Run panel.                  |
| `Ctrl/Cmd+Shift+Enter` | Run all test cases.                                     |
| `Ctrl/Cmd+S`           | Save the current problem (when a save name is set).     |
| `Ctrl/Cmd+1` .. `4`    | Switch to the Run / Tests / Stress / Settings panel.    |
| `Ctrl/Cmd+B`           | Collapse or expand the problems sidebar.                |
| `Ctrl/Cmd+/`           | Toggle a line comment on the selection (in the editor). |

The divider between the editor and the panel area can be dragged;
double-click it to restore the default split.

---

## What persists across reloads

The workbench stores UI state in `localStorage` (keys defined in
`web/lib/storage.ts`). Persisted state is restored on the next load:

| Key                | Holds                                                   |
| ------------------ | ------------------------------------------------------- |
| `cf:code`          | Editor contents.                                        |
| `cf:stdin`         | The Run panel's custom stdin.                           |
| `cf:settings`      | Language standard, time limit, checker, epsilon, flags. |
| `cf:tests`         | Sample test cases.                                      |
| `cf:stress`        | Stress panel sources and iteration count.               |
| `cf:activeProblem` | The currently loaded problem slug.                      |
| `cf:activeTab`     | The selected panel tab.                                 |
| `cf:layout`        | The editor / panel split.                               |
| `cf:fontSize`      | Editor font size.                                       |

All `localStorage` access is guarded, so the app renders correctly on the
server and simply skips persistence if storage is unavailable.

---

## Command-line tool

`scripts/cf` is a Bash script that works from any directory; `bash
scripts/setup.sh` links it onto your `PATH` as `cf`. It shares the include
shim and the statement format with the web workbench.

| Command                          | What it does                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cf template <name> [--from T]`  | Create `./<name>/solution.cpp` and `problem.txt`, verify they compile, open them in VS Code when available. `T` is `dp`, `graph`, `math` or a file.                                    |
| `cf` / `cf <name>` / `cf <file>` | Compile every `.cpp` in the problem directory and run sample #1 (or `--sample N`, an input file, or inline stdin such as `cf "5\n1 2 3"`).                                             |
| `cf test [name]`                 | Run every sample in `problem.txt` with a timeout; prints input, expected, actual and a unified diff on failure, per-sample timing and a summary.                                       |
| `cf stress [name] [-n N]`        | Compile `solution.cpp`, `brute.cpp` and `gen.cpp`, run `N` seeded iterations (default 200, `--seed` to change the first seed) and save the first counter-example to `stress_fail.txt`. |
| `cf samples [name]`              | Print the samples parsed from `problem.txt`.                                                                                                                                           |
| `cf watch [name]`                | Poll the problem directory and re-run `cf test` whenever a `.cpp` or `problem.txt` changes.                                                                                            |
| `cf serve [name]`                | Start the web workbench (`CF_SERVE_PROD=1` for a production build), creating the problem first if needed.                                                                              |
| `cf doctor`                      | Check the compiler, the shim, a compile-and-run smoke test, `timeout`, Node, npm, make, shellcheck and the cache.                                                                      |
| `cf clean`                       | Remove the build cache.                                                                                                                                                                |
| `cf update`                      | Fast-forward the repository and re-run setup.                                                                                                                                          |
| `cf version`                     | Print the version.                                                                                                                                                                     |

Options shared by `run`, `test` and `stress`:

- `--checker lines|tokens` (or `CF_CHECKER`): `lines` ignores trailing
  whitespace and blank lines; `tokens` ignores all whitespace layout. In lines
  mode a mismatch whose tokens match prints a hint.
- `--timeout SEC` (or `CF_TIMEOUT`): execution limit, default 5 seconds. Needs
  GNU `timeout` (or `gtimeout` from Homebrew coreutils on macOS).

`problem.txt` is the statement pasted from Codeforces; samples are parsed from
its `Examples` section exactly as the web importer does. `brute.cpp`,
`gen.cpp` and `generator.cpp` are excluded from the solution build so a stress
setup can live next to the solution. A `samples/N.in` / `samples/N.out` pair
is used when the statement has no examples.

Compiled binaries are cached under `build/.cache` keyed by compiler, flags and
source; `CF_FORCE_REBUILD=1` bypasses the cache. `NO_COLOR=1` disables
colors, `CF_VERBOSE=1` prints debug output, and `.cfconfig` at the repository
root is sourced for per-repo overrides.
