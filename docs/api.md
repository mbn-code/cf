# API reference

The workbench's server API lives under `web/app/api/`. Every route runs on the Node
runtime (`runtime = "nodejs"`) and is dynamic (`dynamic = "force-dynamic"`). Field
names below are transcribed from each route's source and its top-of-file contract
comment; the typed client in `web/lib/api.ts` mirrors them.

All request bodies are JSON. On a bad request a route replies with a non-2xx status
and a body of `{ "error": string }`.

## Summary

| Route               | Method(s)           | Purpose                                                       |
| ------------------- | ------------------- | ------------------------------------------------------------- |
| `/api/run`          | POST                | Compile a source and run it once.                             |
| `/api/test`         | POST                | Compile once, run against many cases, return AC/WA/TLE/RE/CE. |
| `/api/stress`       | POST                | Compare a solution to a brute force on generated inputs.      |
| `/api/problems`     | GET / POST / DELETE | CRUD for saved problems.                                      |
| `/api/config`       | GET                 | Read environment-provided hints.                              |
| `/api/problem-text` | GET / POST          | Load / save a problem statement (`problem.txt`).              |
| `/api/solution`     | GET / POST          | Load / save a solution (`solution.cpp`).                      |
| `/api/template`     | POST                | Fetch a named starter template.                               |

The shared compile/run parameters -- `code`, `timeLimitMs`, `std`, `compilerFlags` --
behave identically everywhere: `std` defaults to `gnu++17`, `timeLimitMs` defaults to
5000 and is clamped to `[100, 60000]`, and `compilerFlags` is a string array appended
to the compile command.

---

## POST /api/run

Compile a single C++ source and run it once with the given stdin.

### Request

```json
{
  "code": "string (required)",
  "input": "string (stdin; `stdin` is accepted as an alias)",
  "timeLimitMs": 5000,
  "std": "gnu++17",
  "compilerFlags": ["-Wall"]
}
```

`code` is required and must be non-empty (otherwise 400). `input` and `stdin` are
interchangeable.

### Response (200)

```json
{
  "ok": true,
  "verdict": "OK",
  "stdout": "string",
  "stderr": "string",
  "exitCode": 0,
  "signal": null,
  "timedOut": false,
  "timeMs": 1.83,
  "truncated": false,
  "compiler": "clang++",
  "compile": { "ok": true, "stderr": "", "ms": 412.5 }
}
```

- `verdict` is one of `OK`, `CE`, `RE`, `TLE`; `ok` is `verdict === "OK"`.
- A compile failure returns 200 with `verdict: "CE"`, `compile.ok: false`, and the
  diagnostics in `compile.stderr` (also mirrored to the top-level `stderr`).
- `stdout`, `stderr`, and `exitCode` are preserved as top-level fields for backward
  compatibility.

---

## POST /api/test

Compile the source once and run it against an array of cases. The binary is reused
across cases.

### Request

```json
{
  "code": "string (required)",
  "tests": [{ "input": "2 3\n", "expected": "5\n" }],
  "timeLimitMs": 5000,
  "std": "gnu++17",
  "compilerFlags": []
}
```

`tests` must contain at least one case (otherwise 400).

### Response (200)

```json
{
  "ok": true,
  "compiler": "clang++",
  "compile": { "ok": true, "stderr": "", "ms": 408.1 },
  "summary": { "total": 1, "passed": 1, "failed": 0, "verdict": "AC" },
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
      "timeMs": 1.2,
      "truncated": false,
      "diff": []
    }
  ]
}
```

- Per-case `verdict` is one of `AC`, `WA`, `TLE`, `RE`, `CE`.
- `diff` is populated only for `WA`: an array of `{ line, expected, actual, same }`
  for the differing lines (capped at 200), under whitespace-tolerant comparison.
- `summary.verdict` is the worst verdict across all cases (ordered
  `AC < WA < TLE < RE < CE`); `ok` is true only when every case is `AC`.
- On a compile failure the route returns 200 with every case marked `CE` (so the UI
  can badge each row) and `summary.verdict: "CE"`.

---

## POST /api/stress

Compile a solution, a brute force, and a generator, then loop: run `generator <seed>`
to produce an input, feed it to both programs, and compare their outputs. Returns the
first input on which they disagree (or on which a program crashes or times out).

### Request

```json
{
  "solution": "string (required)",
  "brute": "string (required)",
  "generator": "string (required)",
  "iterations": 100,
  "timeLimitMs": 5000,
  "seedBase": 1,
  "std": "gnu++17"
}
```

- All three sources are required and must be non-empty (otherwise 400).
- `iterations` defaults to 100 and is clamped to `[1, 5000]`.
- `seedBase` defaults to 1; iteration `i` uses seed `seedBase + i`, passed to the
  generator as `argv[1]`.

### Response (200)

```json
{
  "ok": true,
  "failed": true,
  "iterationsRun": 37,
  "compile": {
    "solution": { "ok": true, "stderr": "", "ms": 410 },
    "brute": { "ok": true, "stderr": "", "ms": 405 },
    "generator": { "ok": true, "stderr": "", "ms": 398 }
  },
  "firstFailure": {
    "iteration": 37,
    "seed": 37,
    "reason": "mismatch",
    "input": "...",
    "solutionOutput": "...",
    "bruteOutput": "...",
    "diff": [{ "line": 1, "expected": "...", "actual": "...", "same": false }]
  },
  "message": "Found a counter-example on iteration 37."
}
```

- `ok` means the three sources compiled and the loop ran -- not that the solution is
  correct. `failed` is true when a counter-example was found.
- `firstFailure.reason` is one of `mismatch`, `solution-error`, `brute-error`,
  `solution-tle`, `brute-tle`, `generator-error`. Depending on the reason, the
  failure may also carry `generatorStderr`, `solutionStderr`, or `bruteStderr`.
- If a source fails to compile, the route returns 200 with `ok: false`,
  `failed: false`, and the offending `compile.<which>.stderr` populated.
- The loop is bounded by an overall 30-second deadline, so `iterationsRun` may be less
  than the requested `iterations`.

---

## /api/problems

CRUD for saved problems, persisted as `web/data/problems/<slug>.json`. A `slug` is
derived from a problem's `name` and is the stable key; saving with the same name
updates the existing record. Routes accept either an exact slug or a human name and
resolve it with `slugify`.

### GET /api/problems

- `GET /api/problems` returns `{ "problems": ProblemSummary[] }`, newest first.
  `ProblemSummary = { name, slug, testCount, updatedAt }`.
- `GET /api/problems?name=<name|slug>` returns `{ "problem": Problem }`, or 404 with
  `{ "error": string }` if not found.

`Problem = { name, slug, code, statement, tests: { input, expected }[], createdAt, updatedAt }`.

### POST /api/problems

Two shapes:

```json
{ "name": "Two Sum", "code": "...", "statement": "...", "tests": [ ... ] }
```

upserts a problem and returns `{ "ok": true, "problem": Problem }`. `name` is
required; `code`, `statement`, and `tests` are optional and preserved from the
existing record when omitted.

```json
{ "op": "rename", "from": "<name|slug>", "to": "New Name" }
```

renames a problem and returns `{ "ok": true, "problem": Problem }`, or 404 if the
source does not exist.

### DELETE /api/problems

`DELETE /api/problems?name=<name|slug>` removes the problem and returns
`{ "ok": true, "deleted": boolean }`. `deleted` is false when no matching file existed.

---

## GET /api/config

Returns environment-provided hints for the UI:

```json
{ "startProblem": "1000A or null", "problemsDir": "/path or null" }
```

Backed by `CF_START_PROBLEM` and `CF_PROBLEMS_DIR`.

---

## /api/problem-text

Per-problem statement stored as `src/<problem>/problem.txt`.

- `GET /api/problem-text?problem=<name>` returns `{ "text": string }` (empty string
  when absent). Missing `problem` is a 400.
- `POST /api/problem-text` with `{ "problem", "text" }` returns `{ "success": true }`.

---

## /api/solution

Per-problem solution stored as `src/<problem>/solution.cpp`.

- `GET /api/solution?problem=<name>` returns `{ "code": string }` (empty string when
  absent). Missing `problem` is a 400.
- `POST /api/solution` with `{ "problem", "code" }` returns `{ "success": true }`.
  A write is skipped when the content is unchanged.

---

## POST /api/template

Fetch a named starter template from `templates/<name>.cpp`.

### Request

```json
{ "name": "dp" }
```

### Response (200)

```json
{
  "stdout": "<template text>",
  "stderr": "",
  "exitCode": 0,
  "content": "<template text>"
}
```

`content` and `stdout` both hold the template text (`stdout` is kept for backward
compatibility). On a miss the route returns `exitCode: 1`, an error in `stderr`, and
empty `content`. The bundled templates are `dp`, `graph`, and `math`.
