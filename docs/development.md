# Development, build, and test

This guide covers running the workbench locally, building it for production,
the quality gates, the portable `Makefile`, and the test suites.

## Prerequisites

- **A C++ compiler.** Apple clang (`clang++` / `c++`), GCC (`g++`) or, on
  Windows, MinGW-w64 or LLVM on `PATH`. On macOS: `xcode-select --install`.
  On Debian / Ubuntu: `sudo apt-get install g++`.
- **Node.js 20 or newer.** The web app targets Next.js 16.
- **Bash** for the CLI and the scripts (Git Bash on Windows).
- **GNU `timeout`** for CLI time limits (`brew install coreutils` on macOS).
- **shellcheck** (optional) for `make check`.
- No global C++ setup is required for `<bits/stdc++.h>`: the bundled shim
  under `include/` is added to every compile via `-I include`.

`cf doctor` verifies all of the above and runs a compile-and-run smoke test:

```bash
bash scripts/cf doctor
```

## Web app

All web commands run from the `web/` directory.

```bash
cd web
npm install        # install dependencies
npm run dev        # start the dev server on http://localhost:3000
npm run build      # production build
npm run start      # serve the production build (after npm run build)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest unit suite (engine + helpers)
npm run e2e        # Playwright end-to-end tests (see below)
npm run check      # lint + typecheck + test + build
```

`npm run dev` enables hot reload; edit `app/page.tsx`, the components, or the
API routes and the page updates. The API routes execute the host compiler, so
a working toolchain is required even in development.

### A note on build tooling and `NODE_ENV`

The build- and lint-critical packages (`typescript`, `eslint`,
`eslint-config-next`, `tailwindcss`, `@tailwindcss/postcss`, the `@types/*`
packages, and friends) live in `dependencies` rather than `devDependencies`
in `web/package.json`. This is deliberate and documented with a `"//"` note
in that file: when an install runs under `NODE_ENV=production`, npm omits
`devDependencies`, which would otherwise make `npm run lint` and
`npm run build` fail with "Cannot find package" errors. Only the test
harnesses (`@playwright/test`, `vitest`) are `devDependencies`. Do not move
the build tooling back.

## Quality gates

`scripts/check.sh` (also `make check`) is the local equivalent of CI:

1. shellcheck on `scripts/cf`, `scripts/check.sh`, `scripts/test.sh`,
   `scripts/validate.sh` and `tests/cli_test.sh` (an LF copy is linted so a
   CRLF checkout gives the same verdict as CI);
2. the CLI test suite;
3. `npm run lint` and `npm run typecheck`;
4. `npm test` (Vitest);
5. `npm run build`;
6. a version-consistency check between `CF_VERSION` in `scripts/cf` and
   `web/package.json`.

`bash scripts/check.sh --quick` skips the production build and
`--no-web` runs only the shell and CLI checks. `scripts/validate.sh`
(`make validate`) is the heavier release gate: install, production build,
Playwright browser install and the full e2e suite.

## Unit tests (Vitest)

`web/app/api/_engine/*.test.ts` exercise the engine directly:

- `cpp.test.ts` compiles and runs real programs: cache hits and coalescing,
  structured diagnostics on a compile error, flag rejection, TLE and RE
  classification, output truncation, oversized sources and spawn failures.
  These cases are skipped (not failed) on a machine without a compiler.
- `compare.test.ts`, `flags.test.ts`, `diagnostics.test.ts`,
  `statement.test.ts` and `store.test.ts` cover the pure helpers; the store
  tests run against a temporary `CF_DATA_DIR`.

```bash
cd web
npm test                 # one run
npm run test:watch       # watch mode
```

## CLI tests

`tests/cli_test.sh` runs the real `scripts/cf` against the real compiler in a
throwaway directory with its own build cache. It covers statement parsing on
the fixture under `tests/fixtures/231A`, sample selection, inline input,
argument precedence, WA / RE / TLE / CE reporting, both checkers, stress
testing (a buggy solution must be caught; a correct one must pass),
templating, `doctor` and `clean`.

```bash
bash tests/cli_test.sh
```

`scripts/test.sh` is the older toolkit runner; it now delegates to the CLI
suite, lints the scripts with `--shellcheck`, and can still compile and diff a
single solution against `tests/example_input.txt` / `example_output.txt`.

## End-to-end tests (Playwright)

The web app ships a Playwright harness. The configuration is in
`web/playwright.config.ts`: it points at `testDir: "./e2e"`, runs a single
worker, and uses a `webServer` that builds and starts the app on
`http://localhost:3000` so the specs drive the real Next app against the real
C++ toolchain (no network mocking). Locally an already-running server on
port 3000 is reused.

```bash
cd web
npm install
npx playwright install chromium   # one-time browser download
npm run e2e                        # or: npx playwright test
```

The specs under `web/e2e/` cover: the smoke path, Run, Tests (AC and WA with
a diff), Stress (no counter-example), persistence across reload, compiler
diagnostics and gutter markers, statement import, the tokens checker and
run-one with rejected flags, stress promotion of a failing input, and the
problems library (save, dirty tracking, new workspace, load, duplicate,
delete). Because the suite compiles real C++ on first run, the timeouts are
generous; the compile cache makes subsequent runs much faster.

### Stable selectors

The UI exposes stable `data-testid` hooks for the e2e suite, including
`run-button`, `run-stdin`, `run-verdict`, `elapsed-time`, `compile-time`,
`terminal-output`, `diagnostics-list`, `rejected-flags`; `#code-editor` and
`code-editor-gutter` (gutter rows carry `data-marker="error|warning"`);
`editor-status`, `error-count`, `warning-count`; `run-all-button`,
`add-test-button`, `import-statement-*`, `run-test-<i>`, `stdin-test-<i>`,
`duplicate-test-<i>`, `test-input-<i>`, `test-expected-<i>`,
`verdict-badge-<i>` (each verdict badge also carries `data-verdict`),
`presentation-hint-<i>`, `tests-summary`; the Stress controls
(`stress-run-button`, `stress-iterations`, `stress-seed`, `stress-failure`,
`stress-add-test`, `stress-use-stdin`, `stress-stats`); the Settings
controls (`settings-std`, `settings-time-limit`, `settings-checker`,
`settings-epsilon`, `settings-flags`, `settings-reset`,
`settings-clear-cache`); and the Problems controls (`save-problem-name`,
`save-problem-button`, `dirty-indicator`, `new-workspace-button`,
`export-problems-button`, `import-problems-input`, `load-problem-<slug>`,
`rename-problem-<slug>`, `duplicate-problem-<slug>`, `confirm-name-<slug>`,
`delete-problem-<slug>`, `confirm-delete-<slug>`). Target these rather than
text or DOM structure so the tests stay robust.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull
request:

- **CLI** on Ubuntu and macOS: shellcheck, `tests/cli_test.sh`, and a
  `Makefile` smoke test.
- **Web** on Ubuntu and macOS: `npm ci`, lint, typecheck, unit tests, build,
  and the version-consistency check.
- **End-to-end** on Ubuntu: the Playwright suite against a production build,
  with the report uploaded on failure.

`.github/workflows/release.yml` runs when a `v*` tag is pushed: it checks
that the tag matches `CF_VERSION` and `web/package.json`, extracts that
version's section from `CHANGELOG.md`, and publishes a GitHub release.

## Portable Makefile

The root `Makefile` builds and runs C++ from the terminal with the same
compiler detection and `-I include` flag as the web engine. It is written to
work on macOS's default bash 3.2 and zsh, with no bashisms and no GNU-only
flags. It avoids both the GNU `timeout` command and the shell `time` builtin,
using Node for high-resolution timing when available and a pure-POSIX
background-and-kill timer otherwise.

```bash
make help                       # show targets and the detected compiler
make all                        # compile every src/**/*.cpp into build/
make build FILE=src/x.cpp       # compile one source
make run   FILE=src/x.cpp       # compile and run with a timeout, timed
make test  FILE=myproblem       # compile and diff vs src/myproblem/input.txt
make debug FILE=src/x.cpp       # compile with -g
make clean                      # remove build artifacts
make check                      # the local quality gate
make web-install | web-dev | web-build | web-test | web-e2e
```

`FILE` resolves, in order, to `src/<FILE>.cpp`, then
`src/<FILE>/solution.cpp`, then a literal path. Useful knobs (override on the
command line):

| Knob       | Default                            | Meaning                               |
| ---------- | ---------------------------------- | ------------------------------------- |
| `FILE`     | `solution`                         | Source selector (see above).          |
| `TL`       | `5`                                | Run / test time limit in seconds.     |
| `CXXSTD`   | `gnu++17`                          | C++ standard.                         |
| `CXXFLAGS` | `-std=$(CXXSTD) -O2 -Wall -Wextra` | Full compile flags.                   |
| `CXX`      | auto-detected                      | Compiler (`clang++` / `c++` / `g++`). |

`make test` reads `src/<FILE>/input.txt`, runs the binary, and diffs the
output against `src/<FILE>/expected.txt` (with trailing whitespace stripped),
printing `AC` or `WA`.

## Releasing

1. Bump `CF_VERSION` in `scripts/cf` and `version` in `web/package.json`
   to the same value and add a section to `CHANGELOG.md`.
2. Run `make check` (and ideally `make validate`).
3. Merge to `main`, then tag and push: `git tag v1.2.3 && git push origin v1.2.3`.
   The release workflow publishes the GitHub release with the changelog
   section as its notes.

## A working compiler is required at runtime

Both the dev server and the production build serve API routes that shell out
to the host compiler. If no compiler is found, `/api/run` and `/api/test`
return a `CE` verdict whose message explains how to install one; see
[troubleshooting.md](troubleshooting.md).
