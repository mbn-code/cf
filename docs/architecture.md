# Architecture

This document describes how the workbench compiles and runs C++ on the server. The
authoritative source is the engine under `web/app/api/_engine/`; the contracts that
the routes expose on top of it are in [api.md](api.md).

## Overview

```
Browser (web/app/page.tsx, components/**)
        |
        |  fetch JSON  (web/lib/api.ts)
        v
Next.js API routes (web/app/api/*/route.ts)   runtime = "nodejs"
        |
        v
Engine (web/app/api/_engine/)
   cpp.ts      compiler detection, compile(), runBinary(), cleanup()
   compare.ts  normalize(), compareOutputs()
   store.ts    problems JSON store + legacy src helpers
        |
        v
Host C++ toolchain  +  include/bits/stdc++.h  +  web/data/**
```

Two ground rules shape the engine:

1. **Node built-ins only.** `cpp.ts`, `compare.ts`, and `store.ts` import nothing but
   `node:child_process`, `node:fs`, `node:os`, and `node:path`. The API tree never
   reaches into `web/lib`, so the server and client never share runtime code.
2. **No shared mutable state on disk.** Every compilation happens in its own unique
   `os.tmpdir()` directory, so concurrent requests cannot collide, and the directory
   is always cleaned up afterwards.

All API routes declare `export const runtime = "nodejs"` and
`export const dynamic = "force-dynamic"` so they run on the Node runtime (not the
Edge runtime) and are never statically cached.

---

## The execution engine: `cpp.ts`

### Compiler detection

`detectCompiler()` returns the first usable C++ compiler or `null`. It honours an
explicit `CF_CXX` (or `CXX`) override, then falls back to a preference list of
`clang++`, `c++`, `g++`. Each candidate is probed with `--version`; the first that
exits 0 is cached for the lifetime of the process. The preference order puts the
macOS default (`clang++` / `c++`) first while still finding `g++` on Linux.

### Compilation

`compile(source, opts)` writes the source to `main.cpp` in a fresh
`mkdtemp(os.tmpdir(), "cf-<label>-")` directory and invokes the compiler with:

```
-std=<std>  -O2  -I <repoRoot>/include  main.cpp  -o prog  [extraFlags...]
```

- `<std>` defaults to `gnu++17` (the project's canonical standard).
- `<repoRoot>/include` is resolved from `CF_REPO_ROOT` if set, otherwise the parent
  of the Next.js `web` directory. This is the directory that holds the
  `<bits/stdc++.h>` shim.
- `extraFlags` are the user's "extra compiler flags" setting, appended verbatim.

Compilation runs through `spawnSync` with a 30-second timeout and a 4 MiB stderr
buffer. The result distinguishes four failure causes via an `error` field:
`no-compiler`, `compile-timeout`, `compile-error`, and `spawn-error`. Compile
wall-clock time is measured with `process.hrtime.bigint()`. `compile()` never throws;
callers must call `cleanup(workDir)` when done with the produced binary.

### Execution

`runBinary(binPath, opts)` spawns the compiled program and:

- feeds `opts.input` to stdin, truncated to **4 MiB** (`MAX_INPUT_BYTES`);
- passes `opts.args` as argv (used to give the stress generator its seed);
- measures wall-clock time with `process.hrtime.bigint()` around the spawn -- never
  the shell `time` builtin, which is unreliable on macOS;
- enforces a time limit (default 5000 ms, clamped to `[100, 60000]` ms). On timeout
  the child is killed with `SIGKILL` and `timedOut` is set;
- caps each of stdout and stderr at **4 MiB** (`MAX_OUTPUT_BYTES`); hitting the cap
  sets `truncated` and (for stdout) kills the child;
- reports the exit code, terminating signal, and any spawn error.

Like `compile()`, `runBinary()` never throws; a failure to spawn surfaces through the
`spawnError` field. `EPIPE` on stdin is ignored, because a program may exit before
consuming all of its input.

### Tunable limits

| Constant                | Value     | Meaning                                       |
| ----------------------- | --------- | --------------------------------------------- |
| `DEFAULT_STD`           | `gnu++17` | Default C++ standard.                         |
| `DEFAULT_TIME_LIMIT_MS` | 5000      | Default per-run wall-clock limit.             |
| `MAX_TIME_LIMIT_MS`     | 60000     | Hard ceiling on a requested time limit.       |
| `COMPILE_TIMEOUT_MS`    | 30000     | Compilation is killed past this.              |
| `MAX_INPUT_BYTES`       | 4 MiB     | Largest stdin payload forwarded to a program. |
| `MAX_OUTPUT_BYTES`      | 4 MiB     | Per-stream output cap before truncation.      |

### How verdicts are derived

The routes turn an engine result into a verdict:

- **TLE** when `timedOut` is true.
- **RE** when there is a spawn error, a non-zero exit code, or a terminating signal.
- **CE** when `compile()` failed (no binary was produced).
- **OK** / **AC** otherwise. For tests, `AC` additionally requires the output to
  match the expected output under tolerant comparison; a non-matching run is `WA`.

---

## Output comparison: `compare.ts`

Competitive-programming judges accept output that differs only in trailing
whitespace, trailing blank lines, and line-ending style. `normalize(s)` encodes that
tolerance:

- convert CRLF and lone CR to LF,
- strip trailing spaces and tabs from every line,
- drop trailing blank lines.

`compareOutputs(expected, actual, maxDiff = 200)` normalizes both sides, reports
whether they match, and returns a compact per-line diff of only the differing lines
(`{ line, expected, actual, same }`). The diff is capped at 200 lines so a
pathological mismatch cannot produce an unbounded payload. `firstMismatch` gives the
1-based line number of the first difference (or -1 on a match). This logic backs both
`/api/test` and `/api/stress`.

---

## Persistence: `store.ts`

`store.ts` owns two kinds of persistence.

### The problems store (`web/data`)

Saved problems live as one JSON file per problem under
`<web>/data/problems/<slug>.json` (override the base with `CF_DATA_DIR`). A `Problem`
record is:

```ts
{ name, slug, code, statement, tests: { input, expected }[], createdAt, updatedAt }
```

`slugify(name)` derives the stable file key by lowercasing, replacing runs of
non-alphanumerics with `-`, trimming dashes, and truncating to 80 characters; an empty
result falls back to `problem`. The store exposes `listProblems` (summaries, newest
first), `getProblem`, `saveProblem` (upsert keyed by slug), `deleteProblem`, and
`renameProblem`. Corrupt or unreadable files are skipped rather than failing a listing.

### Legacy file helpers (`src` tree)

`getSolution` / `saveSolution` and `getProblemText` / `saveProblemText` read and write
`solution.cpp` and `problem.txt` under `src/<problem>/` (override the base with
`CF_PROBLEMS_DIR`), keeping the `/api/solution`, `/api/problem-text`, and
`/api/template` routes self-contained. `readTemplate(name)` reads a starter from the
repository's `templates/<name>.cpp`, with the name sanitized to a safe basename.

---

## The macOS shim: `include/bits/stdc++.h`

`#include <bits/stdc++.h>` is a libstdc++ (GCC) convenience header that pulls in the
whole Standard Library. It is not part of the C++ standard, and Apple clang with
libc++ -- the default on macOS -- does not ship it, so the idiom fails to compile
there.

The repository bundles a portable replacement at `include/bits/stdc++.h`. Because
both the engine and the `Makefile` compile with `-I include`, the idiom resolves to
this shim on macOS, while on GCC it simply shadows the native header with an
equivalent set of includes. Every header that may be absent depending on the standard
library or language mode is gated behind `__has_include`, and the file avoids
GCC-only headers (`<ext/...>`, `<tr1/...>`), so it compiles cleanly on Apple clang /
libc++ and on g++ / libstdc++ alike from C++17 onward.

There is also an `include/stl_utilities.h` header available on the same include path
for shared helpers.

---

## Environment overrides

| Variable           | Effect                                                    |
| ------------------ | --------------------------------------------------------- |
| `CF_CXX` / `CXX`   | Force a specific C++ compiler instead of auto-detection.  |
| `CF_REPO_ROOT`     | Override the repository root used to locate `include/`.   |
| `CF_DATA_DIR`      | Override the base directory for the problems JSON store.  |
| `CF_PROBLEMS_DIR`  | Override the `src` directory for the legacy file helpers. |
| `CF_START_PROBLEM` | Reported by `/api/config` as a starting problem hint.     |

---

## Concurrency and cleanup

Because each compile and run uses a unique temp directory and time is measured
per-process inside Node, multiple requests can execute in parallel without
interfering. The stress route exploits this: it compiles the solution, brute force,
and generator together with `Promise.all`, and runs the solution and brute force on
each input concurrently. Every route wraps its work in `try/finally` and calls
`cleanup()` on each temp directory, so binaries and sources never accumulate.
