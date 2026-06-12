<div align="center">

# cf Workbench

**A local Codeforces-style workbench for writing, running, and stress-testing C++ solutions.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![C++](https://img.shields.io/badge/C%2B%2B-gnu%2B%2B17%20default-blue.svg)](https://en.cppreference.com/w/cpp/17)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20WSL-success.svg)](README.md)

[Features](#features) - [Quick start](#quick-start) - [How it works](#how-it-works) - [Documentation](#documentation)

</div>

---

## About

`cf` is a self-hosted workbench for competitive programming in C++. It pairs a
browser IDE (a Next.js app under `web/`) with a server-side execution engine that
compiles and runs your code against the **real** C++ toolchain on your machine.
Everything runs locally: there is no sandbox VM, no remote judge, and no account.

The workbench is built to make the macOS toolchain a first-class target. The
`#include <bits/stdc++.h>` idiom is a GCC/libstdc++ detail that Apple clang does
not ship, so the repository bundles a portable shim at
[`include/bits/stdc++.h`](include/bits/stdc++.h) and every compile is invoked with
`-I include`. The same flag is used by the web engine and the [`Makefile`](Makefile),
so code that compiles in the UI compiles from the terminal too.

This is a stable release: the engine, the UI, and the build tooling are feature
complete and the production build (`npm run build`) passes clean.

---

## Features

- **C++ editor** with Prism syntax highlighting, a synced line-number gutter,
  soft-tab handling, and an adjustable font. Editor contents persist to
  `localStorage` across reloads.
- **Insertable templates** (Minimal, A + B, Fast I/O + helpers, Brute force,
  Generator) plus a Settings panel for the language standard, per-run time limit,
  and extra compiler flags.
- **Run panel** that POSTs to `/api/run` with custom stdin and renders the verdict,
  exit code, elapsed wall-clock time, compiler, and a scrollable raw terminal log
  of stdout / stderr / compile errors.
- **Tests panel** to add, edit, delete, and paste-and-split sample cases, then
  _Run all_ via `/api/test` for per-case **AC / WA / TLE / RE / CE** badges with an
  expandable, whitespace-tolerant diff.
- **Stress panel** that compiles a solution, a brute force, and a generator, runs
  them for a configurable number of iterations, and surfaces the first failing
  input. It degrades gracefully if the endpoint is unavailable.
- **Problems sidebar** to save, load, rename, and delete problems and their test
  cases, persisted as JSON under `web/data/`.
- **Keyboard shortcuts**: `Cmd/Ctrl+Enter` runs, `Cmd/Ctrl+Shift+Enter` runs all
  tests, `Cmd/Ctrl+S` saves the current problem.

See [`docs/features.md`](docs/features.md) for the complete feature guide.

---

## Quick start

### Prerequisites

- A working C++ compiler. Apple clang (`clang++` / `c++`) or GCC (`g++`) both work.
  On macOS, install the Xcode Command Line Tools: `xcode-select --install`.
- Node.js 20 or newer (the web app targets Next.js 16).

### Run the workbench

```bash
git clone https://github.com/mbn-code/cf.git
cd cf/web
npm install
npm run dev
```

Open <http://localhost:3000>. The editor loads with an A + B program and a `2 3 -> 5`
sample test, so you can click **Run** and see a result immediately.

For a production build:

```bash
npm run build
npm run start
```

### Build from the terminal

The repository also ships a portable [`Makefile`](Makefile) that uses the same
compiler detection and `-I include` flag as the engine:

```bash
make build FILE=src/solution.cpp   # compile one source
make run   FILE=src/solution.cpp   # compile and run with a timeout
make test  FILE=myproblem          # compile and diff vs src/myproblem/input.txt
```

Full setup, build, and test instructions are in
[`docs/development.md`](docs/development.md).

---

## How it works

```
cf/
|- web/                         Next.js workbench (UI + API)
|  |- app/
|  |  |- page.tsx               Workbench shell (editor, panels, shortcuts)
|  |  |- api/
|  |  |  |- _engine/            Server execution engine (Node built-ins only)
|  |  |  |  |- cpp.ts           Compiler detection, compile, run, time-limit, caps
|  |  |  |  |- compare.ts       Whitespace-tolerant output comparison + diff
|  |  |  |  |- store.ts         JSON problem store under web/data
|  |  |  |- run/                POST /api/run    - compile + run once
|  |  |  |- test/               POST /api/test   - run many cases, AC/WA/...
|  |  |  |- stress/             POST /api/stress - solution vs brute + generator
|  |  |  |- problems/           CRUD for saved problems
|  |  |  |- {config,problem-text,solution,template}/
|  |  |- components/            Editor, Run/Tests/Stress panels, sidebar, badges
|  |  |- lib/                   Typed API client, localStorage helpers, templates
|  |- data/problems/           Saved problems (one JSON file per problem)
|- include/bits/stdc++.h        Portable <bits/stdc++.h> shim for clang/libc++
|- Makefile                     Portable terminal build/run/test
|- docs/                        This documentation
```

The execution engine compiles each submission to a unique `os.tmpdir()` directory
with `-std=gnu++17 -O2 -I include`, measures wall-clock time inside Node with
`process.hrtime.bigint()`, enforces the time limit with `SIGKILL` (reported as TLE),
caps stdin / stdout / stderr at 4 MiB, and distinguishes compile errors (CE) from
runtime errors (RE) and spawn failures. Output comparison tolerates trailing
whitespace and trailing blank lines.

A deeper walkthrough lives in [`docs/architecture.md`](docs/architecture.md).

---

## Documentation

| Document                                             | Contents                                                  |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [`docs/features.md`](docs/features.md)               | Full feature guide for every panel and setting.           |
| [`docs/architecture.md`](docs/architecture.md)       | The execution engine, the macOS shim, and the data store. |
| [`docs/api.md`](docs/api.md)                         | Request / response contract for every `/api/*` route.     |
| [`docs/development.md`](docs/development.md)         | Install, run, build, and the Playwright e2e suite.        |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Compiler-not-found, time limits, and macOS notes.         |

---

## Command-line tools

Alongside the workbench, the repository ships a Bash CLI (`scripts/cf`) and the
`Makefile` for terminal-first workflows:

| Command              | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `cf template <name>` | Scaffold `src/<name>/` with a solution and sample files.                                           |
| `cf <name> [input]`  | Compile and run a solution with file or inline input.                                              |
| `cf test`            | Run a solution against its sample cases with timeout protection.                                   |
| `cf serve [problem]` | Start the web workbench.                                                                           |
| `cf update`          | Pull the latest toolkit and re-run setup (see [`docs/UPDATE_COMMAND.md`](docs/UPDATE_COMMAND.md)). |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Released under the MIT License. See [LICENSE](LICENSE).
