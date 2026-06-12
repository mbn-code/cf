# Troubleshooting

Common issues when running the workbench, and what to do about them. The behavior
described here comes from the engine (`web/app/api/_engine/cpp.ts`) and the routes.

## "No C++ compiler found" / every run is a CE

The engine probes `clang++`, then `c++`, then `g++` (after any `CF_CXX` / `CXX`
override). If none responds to `--version`, `/api/run` and `/api/test` return a `CE`
verdict whose message is:

> No C++ compiler found. Tried clang++, c++ and g++. Install the Xcode Command Line
> Tools (`xcode-select --install`) or a g++ toolchain.

Fixes:

- **macOS:** `xcode-select --install` installs Apple clang as `clang++` / `c++`.
- **Debian / Ubuntu:** `sudo apt-get install g++`.
- **Use a specific compiler:** set `CF_CXX` (or `CXX`) to its path or name before
  starting the server, for example `CF_CXX=g++-14 npm run dev`. The override is tried
  first, then the default list.

The detected compiler is cached for the process lifetime, so if you install a
compiler while the server is running, restart it.

## `<bits/stdc++.h>` will not compile

The bundled shim at `include/bits/stdc++.h` only resolves when the compile includes
`-I include`. The web engine and the `Makefile` add this automatically. If you compile
by hand, include it yourself:

```bash
c++ -std=gnu++17 -I include solution.cpp -o solution
```

Confirm the shim works in isolation:

```bash
printf '#include <bits/stdc++.h>\nint main(){std::cout<<"ok\\n";}\n' > /tmp/h.cpp
c++ -std=gnu++17 -I include /tmp/h.cpp -o /tmp/h && /tmp/h
```

The shim gates optional headers behind `__has_include` and avoids GCC-only headers,
so it should build on any C++17-or-later toolchain. If a specific Standard Library
type is missing, raise the standard in Settings (for example `gnu++20`).

## Time-limit exceeded (TLE) when you did not expect it

- The default time limit is **5000 ms**. Raise it in Settings (Time limit) -- it is
  clamped server-side to the range 100-60000 ms.
- A program that waits for more input than it receives will block until the limit and
  then be killed as `TLE`. Check that your program reads exactly the input it is given.
- On timeout the process is terminated with `SIGKILL`, so partial output may be lost.

## Output looks truncated

Each of stdin, stdout, and stderr is capped at **4 MiB**. When a stream hits the cap,
the response sets `truncated: true` and the program may be killed. Reduce the volume
of output (for example, avoid debug prints in a hot loop) if you hit this.

## A correct answer is flagged WA

Comparison is tolerant of trailing whitespace, trailing blank lines, and CRLF vs LF,
so those are not the cause. Genuine differences -- a wrong value, a missing line, or
extra interior whitespace -- will show in the expanded diff. The diff lists up to 200
differing lines; a larger mismatch is truncated to that cap.

## Stress testing finds nothing, or stops early

- `/api/stress` runs up to the requested `iterations` (default 100, max 5000) but is
  also bounded by a 30-second overall deadline, so `iterationsRun` can be lower than
  requested. A slow brute force is the usual reason it stops early.
- The generator must print a valid input to stdout and exit 0; if it fails, the run
  reports a `generator-error`. The iteration seed arrives as `argv[1]` -- use it to
  vary the generated input, or every iteration tests the same case.
- If the Stress panel shows "endpoint not available", the `/api/stress` route is not
  reachable; restart the dev server or rebuild.

## Saved problems do not appear

Problems are stored as JSON under `web/data/problems/` (or `CF_DATA_DIR` if set). The
directory is created on first save. A file that is not valid JSON is silently skipped
when listing, so a hand-edited, malformed file will simply not show up. Check the
directory contents and the file's JSON if a problem goes missing.

## macOS and bash 3.2 notes

macOS ships bash 3.2, and many users run zsh. The `Makefile` and CLI are written for
that reality:

- No bashisms and no GNU-only flags are used, so the `Makefile` runs under bash 3.2
  and zsh without GNU coreutils.
- Timing and timeouts use Node when it is available (high-resolution, cross-platform)
  and fall back to a pure-POSIX background-and-kill timer otherwise. The GNU `timeout`
  command and the shell `time` builtin are intentionally avoided because they are
  unreliable or absent on macOS.
- The web engine never relies on the shell for timing; it measures wall-clock time in
  Node with `process.hrtime.bigint()`.

## `node` / `npm` behave oddly in a custom shell

Some shells wrap `node` / `npm` with an nvm lazy-load shim that can misbehave in
non-interactive contexts. If you see odd errors, invoke the real binaries directly,
for example `/opt/homebrew/bin/node` and `/opt/homebrew/bin/npm` on Apple Silicon, or
the paths your Node install reports via `which -a node`.

## `next build` fails with "Cannot find module 'typescript'" (or eslint, tailwind)

This happens when dependencies were installed under `NODE_ENV=production`, which makes
npm omit `devDependencies`. The project keeps build-critical tooling in
`dependencies` precisely to avoid this; if you still hit it, ensure your install used
the project's `web/package.json` unmodified and re-run `npm install`. See
[development.md](development.md) for the rationale.
