# cf Workbench documentation

This folder documents the `cf` workbench. Start with the
[project README](../README.md) for a high-level tour, then dive into the
topic you need below.

## Contents

| Document                                 | What it covers                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [features.md](features.md)               | Every panel and setting in the browser workbench, every CLI command, the keyboard shortcuts and what persists across reloads.                  |
| [architecture.md](architecture.md)       | The server execution engine (`web/app/api/_engine`), the compile cache, the checkers, the statement parser, the macOS shim and the JSON store. |
| [api.md](api.md)                         | The request / response contract for every `/api/*` route.                                                                                      |
| [development.md](development.md)         | Prerequisites, install, run, build, the quality gates, the unit / CLI / Playwright suites, CI and releasing.                                   |
| [troubleshooting.md](troubleshooting.md) | Compiler not found, ignored flags, time limits, output caps, checkers, the cache, Windows and macOS notes.                                     |
| [UPDATE_COMMAND.md](UPDATE_COMMAND.md)   | The `cf update` CLI command.                                                                                                                   |
| [../CHANGELOG.md](../CHANGELOG.md)       | Release history.                                                                                                                               |

## What `cf` is

`cf` is a local-first workbench for competitive programming in C++. A
Next.js app under `web/` provides the editor and panels, a Bash CLI under
`scripts/` covers the terminal workflow, and a server-side engine compiles
and runs your code against the real C++ toolchain installed on the machine.
Nothing is sent to a remote service.

The defining design choice is portability across toolchains. Every compile
passes `-std=gnu++17 -O2 -I include`, and the bundled
[`include/bits/stdc++.h`](../include/bits/stdc++.h) shim makes the ubiquitous
`#include <bits/stdc++.h>` idiom resolve on Apple clang and libc++ (macOS) as
well as g++ and libstdc++ (Linux / WSL) and MinGW or LLVM on Windows.

## Conventions in these docs

- Paths are relative to the repository root unless noted.
- "The engine" means the shared module at `web/app/api/_engine/`.
- Request / response field names are quoted verbatim from the route source so
  the docs stay in lockstep with the implementation.
- This project does not use emojis in documentation.
