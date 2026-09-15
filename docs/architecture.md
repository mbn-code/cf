# Architecture

This document describes how the workbench executes code: the server engine
under `web/app/api/_engine/`, the checkers, the statement parser, the
portable `<bits/stdc++.h>` shim, the problem store, and how the CLI relates
to all of it.

## Overview

```
browser (web/app/page.tsx + components)
   |  fetch JSON                       web/lib/api.ts (typed client)
   v
Next.js route handlers (web/app/api/*/route.ts)
   |  plain function calls
   v
engine (web/app/api/_engine/*.ts, Node built-ins only)
   |  child_process.spawn / spawnSync
   v
host C++ toolchain (clang++ / c++ / g++) + include/bits/stdc++.h
```

The engine deliberately depends only on Node built-ins (`node:child_process`,
`node:fs`, `node:os`, `node:path`, `node:crypto`) so the `web/app/api` tree
never imports from `web/lib`, and so it can be unit-tested with Vitest
without booting Next.

## The engine (`_engine/cpp.ts`)

### Compiler detection

`detectCompiler()` honours a `CF_CXX` / `CXX` override, then probes
`clang++`, `c++` and `g++` with `--version`. The first responder is cached
for the process lifetime along with the first line of its version output
(exposed by `/api/config`). No compiler means every compile returns
`error: "no-compiler"` with an installation hint.

### Compilation and the cache

`compile(source, { std, extraFlags, label })`:

1. Validates `extraFlags` with `flags.ts` and `std` with `validateStd`.
   Rejected flags are returned as `rejectedFlags` so the UI can explain them.
2. Refuses sources above 1 MiB.
3. Computes a SHA-256 key over compiler, standard, accepted flags and source.
   A cache hit returns the stored binary path immediately with `cached: true`
   and `ms: 0`. Concurrent requests for the same key share one in-flight
   compile.
4. On a miss, writes `main.cpp` into a fresh `mkdtemp` directory, runs
   `<compiler> -std=<std> -O2 -I <repo>/include main.cpp -o prog [flags]`
   with a 30 s timeout, and rewrites the temp path in stderr back to
   `main.cpp` so diagnostics read naturally.
5. A successful build is renamed into the per-process cache root
   (`os.tmpdir()/cf-cache-*`). The cache keeps 48 binaries and evicts the
   least recently used; it is removed when the server exits. A failed build
   keeps its `workDir` so the caller can `cleanup()` it.

On Windows the binary is `prog.exe`; everywhere else it is `prog`.

### Running

`runBinary(binPath, { input, args, timeLimitMs, maxOutputBytes })` spawns the
program with piped stdio, writes stdin (capped at 4 MiB) and collects stdout
and stderr as byte buffers up to 4 MiB each. A `setTimeout` at the clamped
time limit sends `SIGKILL` and marks the run `timedOut`; hitting the stdout
cap also kills the process and sets `truncated`. Wall-clock time is measured
with `process.hrtime.bigint()` around the spawn and rounded to 0.1 ms.

`runVerdict(run)` maps a run to `TLE` (timed out), `RE` (spawn error,
non-zero exit or signal) or `OK`. Routes turn `OK` into `AC`/`WA` by
comparing output.

### Diagnostics (`_engine/diagnostics.ts`)

`parseDiagnostics(stderr)` extracts every `path:line:col: severity: message`
line that gcc and clang emit. Diagnostics that point at a file other than the
user's `main.cpp` (for example inside the shim) keep their message but drop
the line number so the editor never marks a line that is not in the source.

### Flag validation (`_engine/flags.ts`)

The browser sends compiler flags verbatim, so the engine allowlists the
families a contestant needs (`-O`, `-W`, `-w`, `-D`, `-U`, `-f`, `-g`, `-m`,
`-std=`, `-pedantic`, `-static`, `-pthread`, `-pipe`) and denies the ones
that would turn the compiler into a file writer or code loader (`-o`, `-I`,
`-L`, `-l`, `-include`, `@file`, `-fplugin*`, `-fprofile*`, `-Wl,`, `-Wa,`,
`-Wp,`), anything with shell metacharacters, and unknown `-std=` values.

## Checkers (`_engine/compare.ts`)

`compareOutputs(expected, actual, { mode, epsilon })` first normalises both
sides (CRLF to LF, trailing whitespace stripped per line, trailing blank
lines removed), then:

| Mode     | Accepts when                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| `lines`  | the normalised strings are identical.                                                                             |
| `tokens` | the whitespace-separated token sequences are identical (the Codeforces `wcmp` checker).                           |
| `float`  | token counts match and each pair is equal, or both are numbers within `epsilon` absolutely or relative to `max(1, | expected | )`. |

A mismatch produces a per-line diff (`{ line, expected, actual, same }`,
`null` for a missing side, capped at 200 rows) and, in `lines` mode, a
`presentationOnly` flag when the `tokens` checker would have accepted the
output. The CLI implements the same `lines` and `tokens` semantics in Bash.

## Statement parser (`_engine/statement.ts`)

`parseStatement(text)` walks a pasted statement line by line. It records the
first non-empty line as the title, reads `time limit per test` /
`memory limit per test` from the header, and once it sees an `Examples`
heading (or an AtCoder-style `Sample Input N`) collects every
`Input` / `Output` pair until a `Note`, `Explanation` or `Constraints`
heading. Codeforces' `Copy` button text and CRLF line endings are ignored.
Each sample is trimmed and terminated with a single newline. The CLI's awk
parser in `scripts/cf` follows the same rules.

## The problem store (`_engine/store.ts`)

Problems live as `web/data/problems/<slug>.json` (or under `CF_DATA_DIR`).
A record holds the whole workspace: `code`, `statement`, `tests`, `stdin`,
`brute`, `generator`, an optional `settings` snapshot and timestamps.
`normalizeProblem` coerces records written by older versions, so upgrading
never loses a library. Writes go to a sibling temp file and are renamed into
place, so a crash mid-write never leaves a half-written record.

The legacy helpers that read and write `src/<problem>/solution.cpp` and
`problem.txt` validate the problem name as a single safe path segment before
touching the filesystem.

## The `<bits/stdc++.h>` shim

Apple clang ships libc++, which has no `bits/stdc++.h`. The repository
bundles `include/bits/stdc++.h`, an aggregate that includes the whole
Standard Library with optional headers gated behind `__has_include`. Every
compile (engine, CLI and Makefile) passes `-I <repo>/include`, so the idiom
resolves on macOS, Linux and Windows alike; on GCC the shim simply shadows the
native header with an equivalent set of includes.

## Routes

Each route under `web/app/api/*/route.ts` parses its body with the helpers in
`_engine/request.ts` (`readJson`, `parseRunOptions`), calls the engine and
serialises the result. The contracts are documented in [api.md](api.md).
`/api/test` runs cases sequentially so timings are not skewed by CPU
contention; `/api/stress` runs the solution and brute force for one input in
parallel and bounds the whole request at 60 s.

## The browser

`web/app/page.tsx` owns all workbench state, hydrates it from `localStorage`
after mount, persists it back on change, and wires the panels. The panels
are presentational components under `web/components/`; `web/lib/api.ts` is
the only place that talks HTTP. Compiler diagnostics from the latest run feed
the editor's gutter markers until the source changes.

## The CLI

`scripts/cf` is a standalone Bash script with the same conventions: it
compiles with `-I include`, caches binaries under `build/.cache` by a hash of
compiler, flags and sources, parses `problem.txt` with awk, enforces time
limits with GNU `timeout`, and reports `lines`/`tokens` verdicts. `cf serve`
starts the Next.js app with `CF_PROBLEMS_DIR` / `CF_START_PROBLEM` exported,
which `/api/config` reports back to the UI.

## Environment variables

| Variable           | Read by | Effect                                                       |
| ------------------ | ------- | ------------------------------------------------------------ |
| `CF_CXX` / `CXX`   | both    | Compiler to use before the default probe order.              |
| `CF_REPO_ROOT`     | both    | Repository root (default: parent of `web/`).                 |
| `CF_DATA_DIR`      | web     | Where `problems/` JSON files live.                           |
| `CF_PROBLEMS_DIR`  | both    | Directory of `src/<problem>/` folders.                       |
| `CF_START_PROBLEM` | web     | Reported by `/api/config` as a starting problem hint.        |
| `CF_CXXFLAGS`      | CLI     | Full compile flags (default `-std=c++23 -O2 -Wall -Wextra`). |
| `CF_TIMEOUT`       | CLI     | Execution limit in seconds.                                  |
| `CF_CHECKER`       | CLI     | `lines` or `tokens`.                                         |
