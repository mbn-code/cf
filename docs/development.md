# Development, build, and test

This guide covers running the workbench locally, building it for production, the
portable `Makefile`, and the Playwright end-to-end suite.

## Prerequisites

- **A C++ compiler.** Apple clang (`clang++` / `c++`) or GCC (`g++`). On macOS:
  `xcode-select --install`. On Debian / Ubuntu: `sudo apt-get install g++`.
- **Node.js 20 or newer.** The web app targets Next.js 16.
- No global C++ setup is required for `<bits/stdc++.h>`: the bundled shim under
  `include/` is added to every compile via `-I include`.

Verify the compiler resolves the bundled header before starting:

```bash
printf '#include <bits/stdc++.h>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}\n' > /tmp/cf_hdr_check.cpp
c++ -std=gnu++17 -I include /tmp/cf_hdr_check.cpp -o /tmp/cf_hdr_check
echo '2 3' | /tmp/cf_hdr_check     # prints 5
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
npm run e2e        # Playwright end-to-end tests (see below)
```

`npm run dev` enables hot reload; edit `app/page.tsx`, the components, or the API
routes and the page updates. The API routes execute the host compiler, so a working
toolchain is required even in development.

### A note on build tooling and `NODE_ENV`

The build- and lint-critical packages (`typescript`, `eslint`, `eslint-config-next`,
`tailwindcss`, `@tailwindcss/postcss`, the `@types/*` packages, and friends) live in
`dependencies` rather than `devDependencies` in `web/package.json`. This is
deliberate and documented with a `"//"` note in that file: when an install runs under
`NODE_ENV=production`, npm omits `devDependencies`, which would otherwise make
`npm run lint` and `npm run build` fail with "Cannot find package" errors. Keeping
them in `dependencies` guarantees the production build is reproducible regardless of
`NODE_ENV`. Only `@playwright/test` remains a `devDependency`. Do not move these back
into `devDependencies`.

## Portable Makefile

The root `Makefile` builds and runs C++ from the terminal with the same compiler
detection and `-I include` flag as the web engine. It is written to work on macOS's
default bash 3.2 and zsh, with no bashisms and no GNU-only flags. It avoids both the
GNU `timeout` command and the shell `time` builtin, using Node for high-resolution
timing when available and a pure-POSIX background-and-kill timer otherwise.

```bash
make help                       # show targets and the detected compiler
make all                        # compile every src/**/*.cpp into build/
make build FILE=src/x.cpp       # compile one source
make run   FILE=src/x.cpp       # compile and run with a timeout, timed
make test  FILE=myproblem       # compile and diff vs src/myproblem/input.txt
make debug FILE=src/x.cpp       # compile with -g
make clean                      # remove build artifacts
```

`FILE` resolves, in order, to `src/<FILE>.cpp`, then `src/<FILE>/solution.cpp`, then a
literal path. Useful knobs (override on the command line):

| Knob       | Default                            | Meaning                               |
| ---------- | ---------------------------------- | ------------------------------------- |
| `FILE`     | `solution`                         | Source selector (see above).          |
| `TL`       | `5`                                | Run / test time limit in seconds.     |
| `CXXSTD`   | `gnu++17`                          | C++ standard.                         |
| `CXXFLAGS` | `-std=$(CXXSTD) -O2 -Wall -Wextra` | Full compile flags.                   |
| `CXX`      | auto-detected                      | Compiler (`clang++` / `c++` / `g++`). |

```bash
make run FILE=src/x.cpp TL=2          # 2-second time limit
make all CXXSTD=gnu++20               # build everything as gnu++20
```

`make test` reads `src/<FILE>/input.txt`, runs the binary, and diffs the output
against `src/<FILE>/expected.txt` (with trailing whitespace stripped), printing `AC`
or `WA`.

## End-to-end tests (Playwright)

The web app ships a Playwright harness. The configuration is in
`web/playwright.config.ts`: it points at `testDir: "./e2e"`, runs a single worker, and
uses a `webServer` that builds and starts the app on `http://localhost:3000` so the
specs drive the real Next app against the real C++ toolchain (no network mocking).

```bash
cd web
npm install
npx playwright install chromium   # one-time browser download
npm run e2e                        # or: npx playwright test
```

The specs live under `web/e2e/`. They exercise the full pipeline end to end: typing a
`<bits/stdc++.h>` A + B program and running it, adding an `AC` and a `WA` case in the
Tests panel and asserting the badges and diff, and the Stress / Problems happy paths.
Because the suite compiles real C++ on first run, give the `webServer` and the test
timeouts enough headroom for compilation.

### Stable selectors

The UI exposes stable `data-testid` hooks for the e2e suite, including `run-button`,
`run-stdin`, `run-verdict`, `elapsed-time`, `terminal-output`; `#code-editor`;
`run-all-button`, `add-test-button`, `test-input-<i>`, `test-expected-<i>`, and
`verdict-badge-<i>` (each verdict badge also carries `data-verdict="<CODE>"`); the
Stress controls (`stress-run-button`, `stress-iterations`, `stress-failure`); and the
Problems controls (`save-problem-button`, `load-problem-<slug>`, and so on). Target
these rather than text or DOM structure so the tests stay robust.

## A working compiler is required at runtime

Both the dev server and the production build serve API routes that shell out to the
host compiler. If no compiler is found, `/api/run` and `/api/test` return a `CE`
verdict whose message explains how to install one; see
[troubleshooting.md](troubleshooting.md).
