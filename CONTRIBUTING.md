# Contributing to cf

Thanks for taking the time to contribute. This page covers how to report
problems, how the repository is laid out, and what a pull request needs to
pass.

## How can I contribute?

### Reporting bugs

- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- Include the output of `cf doctor` (or the Server block of the Settings tab)
  so we know the compiler and platform.
- Provide reproduction steps: the source, the input, and what you expected.

### Suggesting enhancements

- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- Explain the workflow the feature would improve.

### Pull requests

1. Fork the repository and create your branch from `main`.
2. Add or update tests for the behaviour you change (see below).
3. Run `make check` and make sure it is green.
4. Match the surrounding style; the formatter runs on save for the web app.
5. Write a clear title and description, and add a `CHANGELOG.md` entry under
   an `Unreleased` heading for user-visible changes.

## Development setup

### CLI

The CLI is the single Bash script `scripts/cf`. It must keep working for
both a local clone and a global installation (see the path resolution at the
top of the script), on Linux, macOS (bash 3.2 and zsh) and Git Bash on
Windows.

```bash
bash scripts/cf doctor          # toolchain check
bash tests/cli_test.sh          # 50+ end-to-end checks against the real compiler
shellcheck -s bash scripts/cf   # must be clean
```

### Web workbench

The workbench is built with Next.js 16, React 19, Tailwind CSS 4 and
shadcn/ui. The execution engine under `web/app/api/_engine/` uses only Node
built-ins so it can be unit-tested without the framework.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm test           # vitest unit suite
npm run e2e        # Playwright (npx playwright install chromium once)
npm run check      # lint + typecheck + test + build
```

Every `/api/*` route documents its request and response shape in a comment
at the top of the file and in [docs/api.md](docs/api.md); keep the comment,
the doc and the typed client in `web/lib/api.ts` in sync when you change a
contract.

## Project structure

- `scripts/`: the `cf` CLI, `check.sh` (local quality gate), `validate.sh`
  (release gate), `test.sh`, `build.sh`, `setup.sh`.
- `web/`: the Next.js workbench (UI, API routes, engine, unit and e2e tests).
- `src/`: sample solutions and the CLI template (`template.cpp`).
- `templates/`: C++ starters used by `cf template --from`.
- `include/`: the portable `<bits/stdc++.h>` shim.
- `tests/`: the CLI suite and its fixtures.
- `docs/`: user and developer documentation.

## Tests

| Layer   | Command                  | What it proves                                                   |
| ------- | ------------------------ | ---------------------------------------------------------------- |
| Engine  | `cd web && npm test`     | Compile cache, verdict classification, checkers, parsers, store. |
| CLI     | `bash tests/cli_test.sh` | Real `cf` runs against the real compiler.                        |
| Browser | `cd web && npm run e2e`  | The whole workbench end to end in Chromium.                      |
| Gate    | `make check`             | shellcheck, CLI, lint, typecheck, unit tests, build, versions.   |

Tests must be able to fail for a real reason. Prefer exercising the real
compiler over mocking it.

## Style guidelines

### Bash

- `set -euo pipefail`, quote every expansion, prefer `[ ]` with explicit
  tests as the existing script does, and keep shellcheck clean.
- New commands get a `cmd_<name>` function, a `case` entry in `main`, a help
  entry, and CLI tests.

### C++

- Follow the patterns in `src/template.cpp`.
- Anything shipped as a template must compile with `-std=c++23 -Wall -Wextra`
  and against the shim.

### TypeScript / React

- Functional components and hooks; keep the API tree free of imports from
  `web/lib`.
- Expose a stable `data-testid` on anything the e2e suite needs.
- Guard every `localStorage` access so server rendering keeps working.

## Commit messages

Use the conventional prefixes already in the history:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `refactor:` code changes that neither fix a bug nor add a feature
- `chore:` build, CI and tooling

Example: `feat: import samples from a pasted statement`

## Releasing

See [docs/development.md](docs/development.md#releasing). Versions live in
`scripts/cf` (`CF_VERSION`) and `web/package.json` and must match; CI
enforces it.

## Code of conduct

This project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.
