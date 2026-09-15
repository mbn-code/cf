# API reference

The workbench's server API lives under `web/app/api/`. Every route runs on the
Node runtime (`runtime = "nodejs"`) and is dynamic (`dynamic = "force-dynamic"`).
Field names below are transcribed from each route's source and its top-of-file
contract comment; the typed client in `web/lib/api.ts` mirrors them.

All request bodies are JSON objects. On a bad request a route replies with a
non-2xx status and a body of `{ "error": string }`; malformed JSON is a 400.

## Summary

| Route               | Method(s)           | Purpose                                                       |
| ------------------- | ------------------- | ------------------------------------------------------------- |
| `/api/run`          | POST                | Compile a source and run it once.                             |
| `/api/test`         | POST                | Compile once, run against many cases, return AC/WA/TLE/RE/CE. |
| `/api/stress`       | POST                | Compare a solution to a brute force on generated inputs.      |
| `/api/samples`      | POST                | Parse a pasted statement into sample tests and limits.        |
| `/api/problems`     | GET / POST / DELETE | CRUD, duplicate, export and import for saved problems.        |
| `/api/config`       | GET / DELETE        | Toolchain facts and limits; clear the compile cache.          |
| `/api/template`     | GET / POST          | List / fetch the bundled starter templates.                   |
| `/api/problem-text` | GET / POST          | Load / save a problem statement (`problem.txt`) in `src/`.    |
| `/api/solution`     | GET / POST          | Load / save a solution (`solution.cpp`) in `src/`.            |

### Shared compile / run options

`/api/run`, `/api/test` and `/api/stress` accept the same option fields:

| Field           | Type     | Default   | Notes                                                                  |
| --------------- | -------- | --------- | ---------------------------------------------------------------------- |
| `std`           | string   | `gnu++17` | Validated; unknown standards fall back to the default.                 |
| `timeLimitMs`   | number   | `5000`    | Clamped to `[100, 60000]`.                                             |
| `compilerFlags` | string[] | `[]`      | Validated against an allowlist; rejected flags are reported.           |
| `checker`       | string   | `lines`   | `lines`, `tokens` or `float` (see [architecture.md](architecture.md)). |
| `epsilon`       | number   | `1e-6`    | Float checker tolerance, clamped to `[0, 1]`.                          |

### Shared compile block

Every compile reports the same `compile` object:

```json
{
  "ok": true,
  "stderr": "",
  "ms": 912,
  "cached": false,
  "diagnostics": [
    {
      "severity": "error",
      "line": 5,
      "column": 9,
      "message": "'x' was not declared in this scope"
    }
  ],
  "rejectedFlags": [{ "flag": "-o", "reason": "flag family is not allowed" }]
}
```

`ms` is 0 and `cached` is true when the binary was served from the compile
cache. `diagnostics[].line` is `null` for diagnostics that point at another
file (for example the bundled shim). Sources larger than 1 MiB are refused
with `error: "source-too-large"`; compilation is killed after 30 s.

---

## POST /api/run

Compile a single C++ source and run it once.

Request:

```json
{
  "code": "#include <bits/stdc++.h> ...",
  "input": "2 3\n",
  "timeLimitMs": 2000,
  "std": "gnu++17",
  "compilerFlags": ["-Wall"]
}
```

`stdin` is accepted as an alias for `input`. `code` is required.

Response (200):

```json
{
  "ok": true,
  "verdict": "OK",
  "stdout": "5\n",
  "stderr": "",
  "exitCode": 0,
  "signal": null,
  "timedOut": false,
  "timeMs": 3.2,
  "truncated": false,
  "compiler": "clang++",
  "compile": {
    "ok": true,
    "stderr": "",
    "ms": 912,
    "cached": false,
    "diagnostics": [],
    "rejectedFlags": []
  }
}
```

`verdict` is `OK`, `CE` (compile failed; `compile.stderr` holds the text),
`RE` (non-zero exit, signal or spawn failure) or `TLE` (killed at the time
limit). `timeMs` is wall-clock time measured in Node. `truncated` is set when
stdout or stderr hit the 4 MiB cap.

---

## POST /api/test

Compile once and run against many cases.

Request:

```json
{
  "code": "...",
  "tests": [{ "input": "2 3\n", "expected": "5\n" }],
  "checker": "tokens",
  "stopOnFirstFailure": false
}
```

`code` and a non-empty `tests` array (at most 200 cases) are required.

Response (200):

```json
{
  "ok": true,
  "compiler": "clang++",
  "compile": { "...": "..." },
  "checker": "tokens",
  "summary": {
    "total": 2,
    "passed": 2,
    "failed": 0,
    "skipped": 0,
    "verdict": "AC",
    "maxTimeMs": 4.1,
    "totalTimeMs": 7.9
  },
  "results": [
    {
      "index": 0,
      "verdict": "AC",
      "input": "2 3\n",
      "expected": "5\n",
      "actual": "5\n",
      "stderr": "",
      "exitCode": 0,
      "signal": null,
      "timeMs": 3.8,
      "truncated": false,
      "presentationOnly": false,
      "diff": []
    }
  ]
}
```

Per-case `verdict` is `AC`, `WA`, `TLE`, `RE`, `CE` (every case, when the
compile fails) or `SKIPPED` (after a failure with `stopOnFirstFailure`).
`summary.verdict` is the worst verdict in `CE > RE > TLE > WA > AC` order.
`diff` lists only the differing lines (capped at 200) as
`{ line, expected, actual, same }`, with `null` for a missing side.
`presentationOnly` is true for a `WA` under the `lines` checker whose tokens
match.

---

## POST /api/stress

Compile three sources and search for a counter-example.

Request:

```json
{
  "solution": "...",
  "brute": "...",
  "generator": "...",
  "iterations": 200,
  "seedBase": 1,
  "timeLimitMs": 2000,
  "checker": "lines"
}
```

All three sources are required. `iterations` is clamped to `[1, 5000]`; the
generator receives `seedBase + i` as `argv[1]`.

Response (200):

```json
{
  "ok": true,
  "failed": true,
  "iterationsRun": 7,
  "elapsedMs": 412,
  "deadlineHit": false,
  "stats": { "maxSolutionMs": 5.2, "maxBruteMs": 4.9, "avgSolutionMs": 3.1 },
  "compile": {
    "solution": {
      "ok": true,
      "stderr": "",
      "ms": 900,
      "cached": false,
      "diagnostics": []
    },
    "brute": { "...": "..." },
    "generator": { "...": "..." }
  },
  "firstFailure": {
    "iteration": 7,
    "seed": 7,
    "reason": "mismatch",
    "input": "615 892\n",
    "solutionOutput": "1506\n",
    "bruteOutput": "1507\n",
    "diff": [{ "line": 1, "expected": "1507", "actual": "1506", "same": false }]
  },
  "message": "Found a counter-example on iteration 7."
}
```

`ok` means the sources compiled and the search ran; `failed` means a
counter-example was found. `reason` is one of `mismatch`, `solution-error`,
`brute-error`, `solution-tle`, `brute-tle`, `generator-error`; the error
variants also carry `solutionStderr`, `bruteStderr` or `generatorStderr`. A
compile failure returns `ok: false` with the offending `compile.*.stderr`
populated. The request is bounded by a 60 s budget; `deadlineHit` says when
that cut the search short.

---

## POST /api/samples

Parse a pasted statement.

Request: `{ "statement": "A. Team\ntime limit per test\n2 seconds\n...Examples\nInput\n...\nOutput\n..." }`

Response (200):

```json
{
  "title": "A. Team",
  "timeLimitMs": 2000,
  "memoryLimitMb": 256,
  "tests": [{ "input": "3\n1 1 0\n1 1 1\n1 0 0\n", "expected": "2\n" }]
}
```

Headings are matched case-insensitively (`Examples`, `Example`, `Sample 1`,
`Input`, `Output`, `Sample Input N`, `Sample Output N`, `inputCopy`); a
`Note` heading ends the examples. A statement without samples yields
`tests: []`.

---

## /api/problems

Saved problems are JSON files under `web/data/problems/<slug>.json` (or
`$CF_DATA_DIR/problems`). `slug` is derived from `name` (lowercase,
non-alphanumerics become `-`) and is the stable key; saving with the same
name updates the record. Writes are atomic.

Types:

```ts
TestCase       = { input: string; expected: string }
ProblemSettings= { std?, timeLimitMs?, compilerFlags?, checker?, epsilon? }
Problem        = { name, slug, code, statement, tests: TestCase[], stdin,
                   brute, generator, settings: ProblemSettings | null,
                   createdAt, updatedAt }
ProblemSummary = { name, slug, testCount, updatedAt }
```

| Request                                                                                         | Response                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/problems`                                                                             | `{ problems: ProblemSummary[] }` newest first                      |
| `GET /api/problems?name=<name or slug>`                                                         | `{ problem: Problem }` or 404                                      |
| `GET /api/problems?export=1`                                                                    | `{ version: 1, exportedAt, problems: Problem[] }`                  |
| `POST /api/problems { name, code?, statement?, tests?, stdin?, brute?, generator?, settings? }` | `{ ok, problem }` (upsert; omitted fields keep their stored value) |
| `POST /api/problems { op: "rename", from, to }`                                                 | `{ ok, problem }` or 404                                           |
| `POST /api/problems { op: "duplicate", from, to }`                                              | `{ ok, problem }` or 404                                           |
| `POST /api/problems { op: "import", problems: Problem[], overwrite? }`                          | `{ ok, imported, skipped }`                                        |
| `DELETE /api/problems?name=<name or slug>`                                                      | `{ ok: true, deleted: boolean }`                                   |

Names are limited to 120 characters. Import skips problems that already exist
unless `overwrite` is true, and tolerates records written by older versions.

---

## /api/config

`GET /api/config` returns facts the UI shows in Settings:

```json
{
  "version": "1.0.0",
  "platform": "darwin",
  "compiler": "clang++",
  "compilerVersion": "Apple clang version 16.0.0 (clang-1600.0.26.4)",
  "includeDir": "/path/to/cf/include",
  "defaults": {
    "std": "gnu++17",
    "timeLimitMs": 5000,
    "maxTimeLimitMs": 60000,
    "checker": "lines"
  },
  "limits": {
    "maxSourceBytes": 1048576,
    "maxInputBytes": 4194304,
    "maxOutputBytes": 4194304,
    "compileTimeoutMs": 30000
  },
  "cache": { "entries": 3 },
  "startProblem": null,
  "problemsDir": null
}
```

`startProblem` and `problemsDir` echo `CF_START_PROBLEM` / `CF_PROBLEMS_DIR`
as set by `cf serve`. `DELETE /api/config?cache=1` drops every cached binary
and returns `{ ok: true, cleared: <count> }`.

---

## /api/template

- `GET /api/template` returns `{ "templates": ["dp", "graph", "math"] }`, the
  `.cpp` files under the repository `templates/` directory.
- `POST /api/template` with `{ "name": "dp" }` returns
  `{ stdout, stderr, exitCode, content }`; `stdout` and `content` both hold the
  template text (`stdout` is kept for backward compatibility). A miss returns
  `exitCode: 1` and an error in `stderr`.

## /api/problem-text and /api/solution

These read and write `problem.txt` / `solution.cpp` under `src/<problem>/`
(or `$CF_PROBLEMS_DIR/<problem>/`) for CLI interoperability.

- `GET /api/problem-text?problem=<name>` returns `{ "text": string }` (empty
  when absent); `POST /api/problem-text` with `{ "problem", "text" }` returns
  `{ "success": true }`.
- `GET /api/solution?problem=<name>` returns `{ "code": string }`;
  `POST /api/solution` with `{ "problem", "code" }` returns
  `{ "success": true }`.

`problem` must be a single path segment of letters, digits, `_`, `-` and `.`
that does not start with a dot; anything else (including `..` and path
separators) is rejected with 400. Bodies are capped at 1 MiB.
