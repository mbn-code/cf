# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-15

First tagged release. Everything below is relative to the untagged workbench
that preceded it.

### Added

**Execution engine**

- Compile cache keyed by compiler, standard, flags and source. Re-running
  unchanged code, or running one program against many test cases, no longer
  rebuilds it. Identical concurrent compiles are coalesced; entries are
  evicted least-recently-used and the cache is reclaimed on exit.
- Structured compiler diagnostics (`file:line:col: severity: message`) parsed
  from gcc/clang output and returned by every compile.
- Output checkers: `lines` (default), `tokens` (whitespace-insensitive, the
  Codeforces `wcmp` behaviour) and `float` (absolute/relative epsilon). A `WA`
  whose tokens match is flagged `presentationOnly`.
- Statement parser that turns a pasted Codeforces (or AtCoder-style) problem
  into sample tests plus the declared time and memory limits.
- Windows support for the engine (`prog.exe`, path normalisation in
  diagnostics).

**API**

- `POST /api/samples` parses a statement into tests and limits.
- `GET /api/problems?export=1` and `POST /api/problems {op:"import"}` move a
  whole library as one JSON bundle; `{op:"duplicate"}` copies a problem.
- `/api/test` accepts `checker`, `epsilon` and `stopOnFirstFailure`, and
  reports `SKIPPED` cases, `maxTimeMs` and `totalTimeMs`.
- `/api/stress` accepts `compilerFlags`, `checker`, `epsilon` and `seedBase`,
  and reports `elapsedMs`, `deadlineHit` and per-program timing statistics.
- `GET /api/config` reports the workbench version, compiler version, limits
  and cache size; `DELETE /api/config?cache=1` drops the compile cache.
- `GET /api/template` lists the bundled starter templates.
- Every compile response carries `cached`, `diagnostics` and `rejectedFlags`.

**Web workbench**

- Gutter error/warning markers, a clickable diagnostics list that jumps to the
  line, an error/warning count in the toolbar and a cursor/line/char status
  bar. `Ctrl+/` toggles line comments.
- Tests panel: import samples from a pasted statement, run a single case,
  duplicate a case, send a case's input to stdin, expand/collapse all, stop on
  first failure, whitespace-only hints, per-run max time.
- Stress panel: seed base, timing statistics, request-budget notice, and
  buttons that promote the failing input to a test case or to stdin.
- Settings: checker mode and epsilon, reset to defaults, clear the server
  compile cache, and a read-only server section (compiler, limits, cache).
- Problems sidebar: whole-workspace save (source, statement, tests, stdin,
  stress sources, settings), duplicate, filter, relative timestamps, unsaved
  changes indicator, new-workspace button, export/import of the library.
- Resizable editor/panel split (double-click resets), the active tab and the
  custom stdin persist across reloads, `Ctrl/Cmd+1..4` switch panels,
  `Ctrl/Cmd+B` toggles the sidebar, and the header shows the detected
  compiler.
- Toasts for run/test outcomes and an offline-aware API client.

**CLI (`scripts/cf`)**

- New commands: `stress`, `samples`, `watch`, `doctor`, `clean`, `version`,
  plus `new` as an alias for `template`.
- `template --from dp|graph|math|<file>` scaffolds from a bundled starter.
- `--checker lines|tokens` (or `CF_CHECKER`) on `run`, `test` and `stress`;
  a lines-mode mismatch whose tokens match prints a hint.
- `--timeout` on `run`, `test` and `stress`; per-sample and maximum timing in
  `cf test`; `CF_CXX`/`CXX` compiler override; `NO_COLOR`; `CF_NO_EDITOR`;
  `CF_SERVE_PROD`.
- `brute.cpp`, `gen.cpp` and `generator.cpp` are excluded from the solution
  build so a stress setup lives next to the solution.

**Tooling**

- Vitest unit suite for the engine (compile, cache, TLE/RE classification,
  output caps, checkers, diagnostics, flag validation, statement parsing and
  the store), run with `npm test`.
- `tests/cli_test.sh`: 57 end-to-end checks of the CLI against the real
  compiler (replaces `tests/parser_test.sh` and `test_full.sh`).
- Five new Playwright specs covering diagnostics, statement import, checkers,
  run-one, stress promotion and the problems library.
- `scripts/check.sh` / `make check`: shellcheck, CLI tests, lint, typecheck,
  unit tests, production build and a version-consistency check.
- GitHub Actions: CI on Ubuntu and macOS (CLI, web, Playwright) and a release
  workflow that publishes the CHANGELOG section for a pushed `v*` tag.
- `.gitattributes` pins LF line endings for scripts and sources so Windows
  checkouts run unchanged.

### Changed

- Compiler flags from the browser are validated against an allowlist
  (`-O`, `-W`, `-D`, `-U`, `-f`, `-g`, `-m`, `-std=`, ...). Flags that write
  files or load code (`-o`, `-include`, `@file`, `-fplugin`, `-Wl,` ...) are
  rejected and reported.
- `/api/solution` and `/api/problem-text` reject problem names that are not a
  single safe path segment, closing a path-traversal hole. Malformed JSON on
  any route now yields a 400 instead of a 500.
- The problem store writes atomically (temp file + rename) and tolerates
  records written by older versions.
- The stress request budget is 60 seconds (was 30).
- `cf test <name>` honours the explicit argument even when the working
  directory contains a `problem.txt`.
- `cf update` pulls with `--ff-only` and can skip setup with
  `CF_UPDATE_SKIP_SETUP=1`.
- `scripts/test.sh` reports the program's real exit status (previously the
  negated `if !` status), lints every script and delegates to the CLI suite.
- Version bumped to 1.0.0 in `scripts/cf` and `web/package.json`; CI fails if
  they diverge.

### Removed

- `web/lib/cf.ts` (an unused wrapper that spawned the Bash CLI from Node).
- Unused Next.js scaffold assets under `web/public/`.
- `test_full.sh` and `tests/parser_test.sh` (superseded by
  `tests/cli_test.sh` and `scripts/check.sh`).

[1.0.0]: https://github.com/mbn-code/cf/releases/tag/v1.0.0
