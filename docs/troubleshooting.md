# Troubleshooting

Common issues when running the workbench or the CLI, and what to do about
them. The behaviour described here comes from the engine
(`web/app/api/_engine/cpp.ts`), the routes and `scripts/cf`.

Start with `cf doctor`: it checks the compiler, the shim, a compile-and-run
smoke test, `timeout`, Node, npm, make and shellcheck, and reports the build
cache.

## "No C++ compiler found" / every run is a CE

The engine probes `clang++`, then `c++`, then `g++` (after any `CF_CXX` /
`CXX` override). If none responds to `--version`, `/api/run` and `/api/test`
return a `CE` verdict whose message is:

> No C++ compiler found. Tried clang++, c++ and g++. Install the Xcode Command
> Line Tools (`xcode-select --install`), a g++ toolchain, or set CF_CXX to the
> compiler you want to use.

Fixes:

- **macOS:** `xcode-select --install` installs Apple clang as `clang++` / `c++`.
- **Debian / Ubuntu:** `sudo apt-get install g++`.
- **Windows:** install MinGW-w64 (for example through MSYS2 or Scoop) or LLVM
  and make sure `g++` or `clang++` is on `PATH` for the shell that starts the
  server.
- **Use a specific compiler:** set `CF_CXX` (or `CXX`) to its path or name
  before starting the server, for example `CF_CXX=g++-14 npm run dev`. The
  override is tried first, then the default list.

The detected compiler is cached for the process lifetime, so if you install a
compiler while the server is running, restart it. The Settings tab's Server
block and the header show which compiler was detected.

## `<bits/stdc++.h>` will not compile

The bundled shim at `include/bits/stdc++.h` only resolves when the compile
includes `-I include`. The web engine, the CLI and the `Makefile` add this
automatically. If you compile by hand, include it yourself:

```bash
c++ -std=gnu++17 -I include solution.cpp -o solution
```

Confirm the shim works in isolation:

```bash
printf '#include <bits/stdc++.h>\nint main(){std::cout<<"ok\\n";}\n' > /tmp/h.cpp
c++ -std=gnu++17 -I include /tmp/h.cpp -o /tmp/h && /tmp/h
```

The shim gates optional headers behind `__has_include` and avoids GCC-only
headers, so it should build on any C++17-or-later toolchain. If a specific
Standard Library type is missing, raise the standard in Settings (for example
`gnu++20`).

## A compiler flag I set is ignored

Extra flags are validated against an allowlist (see
[features.md](features.md#allowed-compiler-flags)). The Run and Tests panels
show an "Ignored compiler flags" notice with the reason for each dropped
flag; `/api/*` responses carry them in `compile.rejectedFlags`. Flags that
write files (`-o`), add include or library paths, load plugins or pass
through to the linker are never forwarded.

## Time-limit exceeded (TLE) when you did not expect it

- The default time limit is **5000 ms**. Raise it in Settings (Time limit);
  it is clamped server-side to the range 100-60000 ms. Importing a statement
  sets the limit to the one it declares (often 1000 or 2000 ms).
- A program that waits for more input than it receives will block until the
  limit and then be killed as `TLE`. Check that your program reads exactly
  the input it is given.
- On timeout the process is terminated with `SIGKILL`, so partial output may
  be lost.
- In the CLI, time limits need GNU `timeout` (`gtimeout` from Homebrew
  coreutils on macOS). Without it `cf` warns once and runs unbounded.

## Output looks truncated

Each of stdin, stdout and stderr is capped at **4 MiB**. When a stream hits
the cap, the response sets `truncated: true` and the program may be killed.
Reduce the volume of output (for example, avoid debug prints in a hot loop)
if you hit this.

## A correct answer is flagged WA

Comparison is tolerant of trailing whitespace, trailing blank lines, and CRLF
vs LF, so those are not the cause. Two things to check:

- **"whitespace only"** next to the verdict means the tokens match but the
  layout differs (for example one number per line instead of one line). If
  the judge accepts any layout, switch the checker to **Tokens** in Settings
  (`--checker tokens` in the CLI).
- **Floating-point answers** need the **Float** checker; set the epsilon the
  problem specifies (default `1e-6`, absolute or relative).

Genuine differences show in the expanded diff, which lists up to 200
differing lines.

## The compile cache serves a stale binary

The cache key includes the compiler, the standard, the accepted flags and the
exact source, so any change to those produces a new build. If you replaced
the compiler on disk without restarting the server, restart it, or click
**Clear compile cache** in Settings (`DELETE /api/config?cache=1`). The CLI
cache lives in `build/.cache`; `cf clean` removes it and `CF_FORCE_REBUILD=1`
bypasses it.

## Stress testing finds nothing, or stops early

- `/api/stress` runs up to the requested `iterations` (default 100, max 5000)
  but is also bounded by a 60-second overall deadline, so `iterationsRun` can
  be lower than requested; the result says "request budget reached" when
  that happens. A slow brute force is the usual reason.
- The generator must print a valid input to stdout and exit 0; if it fails,
  the run reports a `generator-error`. The iteration seed arrives as
  `argv[1]`; use it to vary the generated input, or every iteration tests the
  same case. Change the seed base to explore a different region.
- The CLI needs `brute.cpp` and `gen.cpp` (or `generator.cpp`) next to the
  solution, or `--brute` / `--gen` paths.
- If the Stress panel shows "endpoint not available", the `/api/stress` route
  is not reachable; restart the dev server or rebuild.

## Statement import finds no samples

The parser looks for an `Examples` / `Example` heading followed by `Input` and
`Output` headings (or AtCoder-style `Sample Input N` / `Sample Output N`).
Paste the statement as plain text from the problem page, including the
`Examples` heading; the `Copy` button labels Codeforces adds are ignored. A
bare `Input` / `Output` section without an `Examples` heading is treated as
the input-format description, not a sample.

## Saved problems do not appear

Problems are stored as JSON under `web/data/problems/` (or `CF_DATA_DIR` if
set). The directory is created on first save. A file that is not valid JSON
is silently skipped when listing, so a hand-edited, malformed file will
simply not show up. Check the directory contents and the file's JSON if a
problem goes missing. **Export** in the sidebar downloads the whole library
as one bundle, which is the easiest way to move or back it up.

## Windows notes

- Run the CLI from Git Bash (or WSL). The repository's `.gitattributes` pins
  LF line endings for scripts, so a checkout with `core.autocrlf=true` still
  runs them unchanged.
- The engine names binaries `prog.exe` and normalises the temp path in
  diagnostics, so the workbench works with MinGW-w64 and LLVM.
- `timeout` comes with Git for Windows' coreutils.

## macOS and bash 3.2 notes

macOS ships bash 3.2, and many users run zsh. The `Makefile` and CLI are
written for that reality:

- No bashisms and no GNU-only flags are used, so the `Makefile` runs under
  bash 3.2 and zsh without GNU coreutils.
- Timing and timeouts use Node when it is available (high-resolution,
  cross-platform) and fall back to a pure-POSIX background-and-kill timer
  otherwise.
- `scripts/cf` reports timings in milliseconds when `EPOCHREALTIME` (bash 5)
  or GNU `date +%s%N` is available and falls back to whole seconds.
- The web engine never relies on the shell for timing; it measures wall-clock
  time in Node with `process.hrtime.bigint()`.

## `node` / `npm` behave oddly in a custom shell

Some shells wrap `node` / `npm` with an nvm lazy-load shim that can misbehave
in non-interactive contexts. If you see odd errors, invoke the real binaries
directly, for example `/opt/homebrew/bin/node` and `/opt/homebrew/bin/npm` on
Apple Silicon, or the paths your Node install reports via `which -a node`.

## `next build` fails with "Cannot find module 'typescript'" (or eslint, tailwind)

This happens when dependencies were installed under `NODE_ENV=production`,
which makes npm omit `devDependencies`. The project keeps build-critical
tooling in `dependencies` precisely to avoid this; if you still hit it,
ensure your install used the project's `web/package.json` unmodified and
re-run `npm install`. See [development.md](development.md) for the
rationale.
