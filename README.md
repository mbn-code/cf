<div align="center">

# cf Workbench

**A local Codeforces-style workbench for writing, running, testing and stress-testing C++ solutions.**

[![CI](https://github.com/mbn-code/cf/actions/workflows/ci.yml/badge.svg)](https://github.com/mbn-code/cf/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![C++](https://img.shields.io/badge/C%2B%2B-gnu%2B%2B17%20default-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20WSL%20%7C%20Windows-success.svg)](README.md)

[Features](#features) - [Quick start](#quick-start) - [CLI](#command-line-tool) - [How it works](#how-it-works) - [Documentation](#documentation)

</div>

---

## About

`cf` is a self-hosted workbench for competitive programming in C++. It pairs a
browser IDE (a Next.js app under `web/`) and a Bash CLI (`scripts/cf`) with a
server-side execution engine that compiles and runs your code against the
**real** C++ toolchain on your machine. Everything runs locally: there is no
sandbox VM, no remote judge, and no account.

The workbench treats every toolchain as a first-class target. The
`#include <bits/stdc++.h>` idiom is a GCC/libstdc++ detail that Apple clang
does not ship, so the repository bundles a portable shim at
[`include/bits/stdc++.h`](include/bits/stdc++.h) and every compile is invoked
with `-I include`. The same flag is used by the web engine, the CLI and the
[`Makefile`](Makefile), so code that compiles in the UI compiles from the
terminal too. Linux (g++), macOS (Apple clang), WSL and Windows (MinGW or
LLVM, via Git Bash) are all exercised by the test suites.

---

## Features

### Browser workbench

- **C++ editor** with Prism syntax highlighting, a line-number gutter that
  shows compiler error and warning markers, soft tabs, `Ctrl+/` comment
  toggling, a cursor position status bar and an adjustable font. Contents
  persist to `localStorage` across reloads.
- **Compiler diagnostics** parsed into a clickable list: click an error to
  jump to the offending line. Disallowed compiler flags are reported rather
  than silently dropped.
- **Compile cache**: a source that has already been built is not rebuilt.
  Running the same program against twenty cases, or re-running after editing
  only the stdin, skips the multi-second `<bits/stdc++.h>` instantiation.
- **Run panel** with custom stdin, verdict, exit code, wall-clock time,
  compile time and a scrollable raw terminal log.
- **Tests panel** to add, edit, duplicate and delete sample cases, run all of
  them or a single one, stop on the first failure, and see per-case
  **AC / WA / TLE / RE / CE** badges with a line diff. **Import from
  statement** turns a pasted Codeforces problem into test cases and applies
  the statement's time limit.
- **Output checkers**: exact lines (trailing whitespace ignored),
  whitespace-insensitive tokens (the Codeforces `wcmp` checker), or floating
  point with an absolute/relative epsilon. A `WA` whose tokens match is
  flagged as a whitespace-only difference.
- **Stress panel** that compiles a solution, a brute force and a generator,
  runs them for a configurable number of seeded iterations, reports timing
  statistics, and surfaces the first failing input. One click adds that input
  as a test case (with the brute force's answer as expected output) or sends
  it to the Run panel's stdin.
- **Problems sidebar** that saves the whole workspace (source, statement,
  tests, stdin, stress sources and settings) as JSON under `web/data/`, with
  load, rename, duplicate, delete, filter, an unsaved-changes indicator, and
  export/import of the whole library.
- **Resizable layout**, remembered tab, and keyboard shortcuts:
  `Ctrl/Cmd+Enter` run, `Ctrl/Cmd+Shift+Enter` run all, `Ctrl/Cmd+S` save,
  `Ctrl/Cmd+1..4` switch panels, `Ctrl/Cmd+B` toggle the sidebar.

### Command-line tool

- `cf test` parses `problem.txt` (pasted straight from Codeforces), runs every
  sample with a timeout, prints a diff on failure and reports per-sample
  timing.
- `cf stress` runs `solution.cpp` against `brute.cpp` on inputs from
  `gen.cpp`, saving the first counter-example to `stress_fail.txt`.
- `cf watch` re-runs the samples whenever a source file changes.
- `cf template <name> --from dp|graph|math` scaffolds a problem directory from
  one of the bundled starters; `cf samples`, `cf doctor`, `cf clean` and
  `cf version` round out the toolkit.
- Line and token checkers (`--checker tokens` or `CF_CHECKER=tokens`), a
  build cache keyed by source and flags, and `NO_COLOR` support.

See [`docs/features.md`](docs/features.md) for the complete feature guide.

---

## Quick start

### Prerequisites

- A working C++ compiler. Apple clang (`clang++` / `c++`), GCC (`g++`) and
  MinGW/LLVM on Windows all work. On macOS, install the Xcode Command Line
  Tools: `xcode-select --install`.
- Node.js 20 or newer for the web workbench (the app targets Next.js 16).
- Bash for the CLI (Git Bash on Windows). `timeout` (GNU coreutils) enables
  time limits in the CLI; on macOS `brew install coreutils`.

### Run the workbench

```bash
git clone https://github.com/mbn-code/cf.git
cd cf/web
npm install
npm run dev
```

Open <http://localhost:3000>. The editor loads with an A + B program and a
`2 3 -> 5` sample test, so you can click **Run** and see a result
immediately. Paste a Codeforces statement into **Tests -> From statement** to
turn its examples into test cases.

For a production build:

```bash
npm run build
npm run start
```

### Use the CLI

```bash
# optional: put `cf` on your PATH
ln -s "$PWD/scripts/cf" ~/.local/bin/cf     # or: bash scripts/setup.sh

cf doctor                    # verify compiler, shim, timeout, node
cf template 1000A            # ./1000A/solution.cpp + problem.txt
cd 1000A                     # paste the statement into problem.txt
cf test                      # run every sample, timed, with diffs
cf test --checker tokens     # whitespace-insensitive comparison
cf stress -n 500             # needs brute.cpp and gen.cpp next to solution.cpp
cf serve                     # open this problem in the web workbench
```

### Build from the terminal

The [`Makefile`](Makefile) uses the same compiler detection and `-I include`
flag as the engine:

```bash
make build FILE=src/solution.cpp   # compile one source
make run   FILE=src/solution.cpp   # compile and run with a timeout
make test  FILE=myproblem          # compile and diff vs src/myproblem/input.txt
make check                         # shellcheck + CLI tests + web lint/typecheck/unit/build
```

Full setup, build, and test instructions are in
[`docs/development.md`](docs/development.md).

---

## How it works

```
cf/
|- scripts/cf                   Bash CLI: template, run, test, stress, watch, serve, doctor
|- web/                         Next.js workbench (UI + API)
|  |- app/
|  |  |- page.tsx               Workbench shell (editor, panels, shortcuts, layout)
|  |  |- api/
|  |  |  |- _engine/            Server execution engine (Node built-ins only)
|  |  |  |  |- cpp.ts           Compiler detection, compile cache, run, time limit, caps
|  |  |  |  |- compare.ts       lines / tokens / float checkers + line diff
|  |  |  |  |- diagnostics.ts   gcc/clang stderr -> structured diagnostics
|  |  |  |  |- flags.ts         Compiler-flag allowlist and -std validation
|  |  |  |  |- statement.ts     Codeforces statement -> samples + limits
|  |  |  |  |- store.ts         Atomic JSON problem store under web/data
|  |  |  |- run/                POST /api/run      - compile + run once
|  |  |  |- test/               POST /api/test     - run many cases, AC/WA/...
|  |  |  |- stress/             POST /api/stress   - solution vs brute + generator
|  |  |  |- samples/            POST /api/samples  - parse a pasted statement
|  |  |  |- problems/           CRUD + export/import for saved problems
|  |  |  |- config/             Toolchain facts, compile-cache reset
|  |  |- components/            Editor, Run/Tests/Stress/Settings panels, sidebar
|  |  |- lib/                   Typed API client, localStorage helpers, templates
|  |- e2e/                      Playwright suite (real browser, real compiler)
|  |- data/problems/            Saved problems (one JSON file per problem)
|- include/bits/stdc++.h        Portable <bits/stdc++.h> shim for clang/libc++
|- templates/                   dp / graph / math starters for `cf template --from`
|- tests/cli_test.sh            CLI end-to-end suite (real compiler)
|- Makefile                     Portable terminal build/run/test + quality gates
|- docs/                        This documentation
```

The execution engine writes each submission to a unique temp directory,
compiles it with `-std=gnu++17 -O2 -I include` plus any allowlisted extra
flags, and caches the binary by a hash of compiler, standard, flags and
source. Runs are measured with `process.hrtime.bigint()`, killed with
`SIGKILL` at the time limit (reported as TLE), and capped at 4 MiB of stdin,
stdout and stderr. Compile errors (CE) are distinguished from runtime errors
(RE) and spawn failures, and compiler output is parsed into
`file:line:col` diagnostics.

A deeper walkthrough lives in [`docs/architecture.md`](docs/architecture.md).

---

## Documentation

| Document                                             | Contents                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/features.md`](docs/features.md)               | Full feature guide for every panel, setting and CLI command.    |
| [`docs/architecture.md`](docs/architecture.md)       | The execution engine, checkers, the macOS shim, the data store. |
| [`docs/api.md`](docs/api.md)                         | Request / response contract for every `/api/*` route.           |
| [`docs/development.md`](docs/development.md)         | Install, run, build, unit tests, the Playwright suite and CI.   |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Compiler-not-found, time limits, Windows and macOS notes.       |
| [`CHANGELOG.md`](CHANGELOG.md)                       | Release history.                                                |

---

## Command-line tool

| Command                             | Description                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `cf template <name> [--from T]`     | Scaffold `./<name>/` with `solution.cpp` and `problem.txt` (T: dp, graph, math).             |
| `cf <name\|file> [input]`           | Compile and run a solution against a sample, a file or inline input.                         |
| `cf test [name] [--checker tokens]` | Run every sample in `problem.txt` with a timeout, timing and diffs.                          |
| `cf stress [name] [-n N]`           | Solution vs `brute.cpp` on `gen.cpp` inputs; saves the first counter-example.                |
| `cf samples [name]`                 | Print the samples parsed from `problem.txt`.                                                 |
| `cf watch [name]`                   | Re-run the samples whenever a source file changes.                                           |
| `cf serve [name]`                   | Start the web workbench (creates the problem if needed).                                     |
| `cf doctor`                         | Check compiler, shim, `timeout`, Node and the build cache.                                   |
| `cf clean`                          | Remove the build cache.                                                                      |
| `cf update`                         | Fast-forward to the latest version (see [`docs/UPDATE_COMMAND.md`](docs/UPDATE_COMMAND.md)). |

Run `cf help` for every option and environment variable.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
`make check` runs the same gate as CI.

## License

Released under the MIT License. See [LICENSE](LICENSE).
