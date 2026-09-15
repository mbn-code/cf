/**
 * web/app/api/_engine/cpp.ts
 *
 * Self-contained C++ compile/run engine for the cf workbench API routes.
 *
 * This module depends ONLY on Node.js built-ins so the `web/app/api` tree
 * never reaches into other workspaces (e.g. web/lib). It powers /api/run,
 * /api/test and /api/stress.
 *
 * Design notes:
 *  - The bundled portable `<bits/stdc++.h>` lives at <repoRoot>/include, so every
 *    compile passes `-I <repoRoot>/include` and the idiom resolves on macOS
 *    (clang/libc++) as well as Linux (g++/libstdc++) and MinGW on Windows.
 *  - Wall-clock time is measured inside Node with process.hrtime.bigint() around
 *    the spawn — never the shell `time` builtin (which is unreliable on macOS).
 *  - Compiled binaries are cached by a hash of (compiler, std, flags, source).
 *    Re-running unchanged code, or running the same source against many test
 *    cases, skips the multi-second `<bits/stdc++.h>` instantiation entirely.
 *    Cache entries live under a per-process temp directory and are evicted
 *    least-recently-used once the cap is reached.
 *  - Cache misses compile in a unique temp directory so concurrent requests
 *    never collide; identical concurrent compiles are coalesced.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateFlags, validateStd } from "./flags";
import { parseDiagnostics, type Diagnostic } from "./diagnostics";

// ==================== Tunables ====================

/** Default C++ standard. `gnu++17` matches the project's validation command. */
export const DEFAULT_STD = "gnu++17";
/** Default per-run wall-clock limit (ms) before a program is killed as TLE. */
export const DEFAULT_TIME_LIMIT_MS = 5000;
/** Hard ceiling so a caller can never request an unbounded time limit. */
export const MAX_TIME_LIMIT_MS = 60_000;
/** Compilation is killed if it exceeds this (runaway template instantiation). */
export const COMPILE_TIMEOUT_MS = 30_000;
/** Largest source accepted for compilation. */
export const MAX_SOURCE_BYTES = 1024 * 1024; // 1 MiB
/** Largest stdin payload forwarded to a program. */
export const MAX_INPUT_BYTES = 4 * 1024 * 1024; // 4 MiB
/** Largest stdout/stderr captured per stream; excess is truncated. */
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024; // 4 MiB
/** Number of compiled binaries kept in the cache before LRU eviction. */
export const COMPILE_CACHE_ENTRIES = 48;

/** Compiler candidates, in preference order: clang++/c++ (macOS) then g++. */
const COMPILER_CANDIDATES = ["clang++", "c++", "g++"];

const IS_WINDOWS = process.platform === "win32";
const BIN_NAME = IS_WINDOWS ? "prog.exe" : "prog";
const SRC_NAME = "main.cpp";

// ==================== Paths ====================

/** Absolute path to the repository root (the parent of the Next.js `web` dir). */
export function repoRoot(): string {
  const override = process.env.CF_REPO_ROOT;
  return override ? path.resolve(override) : path.resolve(process.cwd(), "..");
}

/** Absolute path to the bundled include directory that holds bits/stdc++.h. */
export function includeDir(): string {
  return path.join(repoRoot(), "include");
}

// ==================== Compiler detection ====================

let cachedCompiler: string | null = null;
let cachedVersion: string | null = null;

/**
 * Return the first usable C++ compiler, or null if none is installed.
 * Honours an explicit `CF_CXX` / `CXX` override, then falls back to the
 * preference list. A positive result is cached for the process lifetime.
 */
export function detectCompiler(): string | null {
  if (cachedCompiler) return cachedCompiler;
  const override = process.env.CF_CXX || process.env.CXX;
  const candidates = override
    ? [override, ...COMPILER_CANDIDATES]
    : COMPILER_CANDIDATES;
  for (const cand of candidates) {
    try {
      const probe = spawnSync(cand, ["--version"], { encoding: "utf8" });
      if (!probe.error && probe.status === 0) {
        cachedCompiler = cand;
        cachedVersion = (probe.stdout || "").split(/\r?\n/)[0]?.trim() || null;
        return cand;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** First line of `<compiler> --version`, or null when no compiler is found. */
export function compilerVersion(): string | null {
  if (!detectCompiler()) return null;
  return cachedVersion;
}

// ==================== Compilation ====================

export type CompileResult = {
  /** True when the binary was produced with exit status 0. */
  ok: boolean;
  /** The compiler that was used, or null when none was found. */
  compiler: string | null;
  /** Compiler diagnostics (the "CE" text shown to the user). */
  stderr: string;
  /** Structured diagnostics parsed from `stderr`. */
  diagnostics: Diagnostic[];
  /** Absolute path to the produced executable, or null on failure. */
  binPath: string | null;
  /**
   * The unique temp directory holding the sources/binary for an uncached
   * failure; null for cache-backed results. Always pass it to cleanup().
   */
  workDir: string | null;
  /** Compile wall-clock time in milliseconds (0 on a cache hit). */
  ms: number;
  /** True when the binary came from the compile cache. */
  cached: boolean;
  /** Flags that were dropped by validation, with a reason each. */
  rejectedFlags: { flag: string; reason: string }[];
  /** Machine-readable failure cause, when ok === false. */
  error?:
    | "no-compiler"
    | "compile-timeout"
    | "compile-error"
    | "spawn-error"
    | "source-too-large";
};

export type CompileOptions = {
  /** C++ standard without the `-std=` prefix (default `gnu++17`). */
  std?: string;
  /** Extra compiler flags; validated against an allowlist before use. */
  extraFlags?: string[];
  /** Short label used in the temp directory name. */
  label?: string;
};

type CacheEntry = { binPath: string; stderr: string; lastUsed: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CompileResult>>();
let cacheRootPromise: Promise<string> | null = null;

function cacheRoot(): Promise<string> {
  if (!cacheRootPromise) {
    cacheRootPromise = mkdtemp(path.join(os.tmpdir(), "cf-cache-")).then(
      (dir) => {
        // Reclaim the whole cache when the server exits normally.
        process.once("exit", () => {
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            // best effort
          }
        });
        return dir;
      },
    );
  }
  return cacheRootPromise;
}

function cacheKey(
  compiler: string,
  std: string,
  flags: string[],
  source: string,
): string {
  return createHash("sha256")
    .update(compiler)
    .update("\0")
    .update(std)
    .update("\0")
    .update(flags.join(" "))
    .update("\0")
    .update(source)
    .digest("hex");
}

async function evictIfNeeded(): Promise<void> {
  while (cache.size > COMPILE_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, v] of cache) {
      if (v.lastUsed < oldest) {
        oldest = v.lastUsed;
        oldestKey = k;
      }
    }
    if (!oldestKey) break;
    const entry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (entry) await cleanup(path.dirname(entry.binPath));
  }
}

/** Drop every cached binary. Exposed for tests and for /api/config resets. */
export async function clearCompileCache(): Promise<void> {
  const entries = [...cache.values()];
  cache.clear();
  await Promise.all(entries.map((e) => cleanup(path.dirname(e.binPath))));
}

/** Number of binaries currently held in the compile cache. */
export function compileCacheSize(): number {
  return cache.size;
}

function noCompilerResult(): CompileResult {
  return {
    ok: false,
    compiler: null,
    stderr:
      "No C++ compiler found. Tried clang++, c++ and g++. Install the Xcode " +
      "Command Line Tools (`xcode-select --install`), a g++ toolchain, or " +
      "set CF_CXX to the compiler you want to use.",
    diagnostics: [],
    binPath: null,
    workDir: null,
    ms: 0,
    cached: false,
    rejectedFlags: [],
    error: "no-compiler",
  };
}

/**
 * Compile a single C++ translation unit, serving from the compile cache when
 * the exact same (compiler, std, flags, source) tuple was built before.
 * Never throws — failures are reported through the returned CompileResult.
 * Callers MUST cleanup(result.workDir) when finished with the binary.
 */
export async function compile(
  source: string,
  opts: CompileOptions = {},
): Promise<CompileResult> {
  const compiler = detectCompiler();
  if (!compiler) return noCompilerResult();

  const { accepted: flags, rejected } = validateFlags(opts.extraFlags ?? []);
  const std = validateStd(opts.std, DEFAULT_STD);

  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    return {
      ok: false,
      compiler,
      stderr: `Source exceeds the ${MAX_SOURCE_BYTES / 1024} KiB limit.`,
      diagnostics: [],
      binPath: null,
      workDir: null,
      ms: 0,
      cached: false,
      rejectedFlags: rejected,
      error: "source-too-large",
    };
  }

  const key = cacheKey(compiler, std, flags, source);
  const hit = cache.get(key);
  if (hit) {
    hit.lastUsed = Date.now();
    return {
      ok: true,
      compiler,
      stderr: hit.stderr,
      diagnostics: parseDiagnostics(hit.stderr, SRC_NAME),
      binPath: hit.binPath,
      workDir: null,
      ms: 0,
      cached: true,
      rejectedFlags: rejected,
    };
  }

  const pending = inflight.get(key);
  if (pending) {
    const r = await pending;
    return { ...r, rejectedFlags: rejected, cached: r.ok ? true : r.cached };
  }

  const job = compileUncached(source, compiler, std, flags, key, opts.label);
  inflight.set(key, job);
  try {
    const r = await job;
    return { ...r, rejectedFlags: rejected };
  } finally {
    inflight.delete(key);
  }
}

async function compileUncached(
  source: string,
  compiler: string,
  std: string,
  flags: string[],
  key: string,
  label?: string,
): Promise<CompileResult> {
  const workDir = await mkdtemp(
    path.join(os.tmpdir(), `cf-${label ?? "build"}-`),
  );
  const srcPath = path.join(workDir, SRC_NAME);
  const binPath = path.join(workDir, BIN_NAME);
  await writeFile(srcPath, source, "utf8");

  const args = [
    `-std=${std}`,
    "-O2",
    "-I",
    includeDir(),
    srcPath,
    "-o",
    binPath,
    ...flags,
  ];

  const start = process.hrtime.bigint();
  const res = spawnSync(compiler, args, {
    encoding: "utf8",
    timeout: COMPILE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    cwd: workDir,
  });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  const timedOut =
    !!res.error && (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  const ok = !res.error && res.status === 0;

  // Present the temp path as plain `main.cpp` so diagnostics read naturally.
  let stderr = (res.stderr ?? "").split(srcPath).join(SRC_NAME);
  if (IS_WINDOWS)
    stderr = stderr.split(srcPath.replace(/\\/g, "/")).join(SRC_NAME);
  if (res.error && !timedOut) stderr = `${stderr}\n${res.error.message}`.trim();
  if (timedOut) {
    stderr =
      `${stderr}\nCompilation timed out after ${COMPILE_TIMEOUT_MS} ms.`.trim();
  }
  const diagnostics = parseDiagnostics(stderr, SRC_NAME);

  if (!ok) {
    return {
      ok,
      compiler,
      stderr,
      diagnostics,
      binPath: null,
      workDir,
      ms,
      cached: false,
      rejectedFlags: [],
      error: timedOut
        ? "compile-timeout"
        : res.error
          ? "spawn-error"
          : "compile-error",
    };
  }

  // Move the finished build into the cache. On a rename race the other copy
  // wins and ours is discarded.
  const root = await cacheRoot();
  const target = path.join(root, key);
  let finalBin = binPath;
  try {
    await mkdir(root, { recursive: true });
    await rename(workDir, target);
    finalBin = path.join(target, BIN_NAME);
  } catch {
    const existing = await stat(path.join(target, BIN_NAME)).catch(() => null);
    if (existing) {
      await cleanup(workDir);
      finalBin = path.join(target, BIN_NAME);
    }
  }
  cache.set(key, { binPath: finalBin, stderr, lastUsed: Date.now() });
  await evictIfNeeded();

  return {
    ok,
    compiler,
    stderr,
    diagnostics,
    binPath: finalBin,
    workDir: null,
    ms,
    cached: false,
    rejectedFlags: [],
  };
}

// ==================== Execution ====================

export type RunResult = {
  stdout: string;
  stderr: string;
  /** Process exit code, or null when it was terminated by a signal. */
  exitCode: number | null;
  /** Terminating signal name, or null on a normal exit. */
  signal: string | null;
  /** True when the program was killed for exceeding the time limit. */
  timedOut: boolean;
  /** Wall-clock execution time in milliseconds (measured in Node). */
  timeMs: number;
  /** True when captured stdout/stderr hit the size cap and was truncated. */
  truncated: boolean;
  /** Set when the binary could not be spawned at all. */
  spawnError?: string;
};

export type RunOptions = {
  /** Data fed to the program's stdin (capped at MAX_INPUT_BYTES). */
  input?: string;
  /** Extra argv passed to the program (e.g. a generator seed). */
  args?: string[];
  /** Wall-clock limit in ms (clamped to [100, MAX_TIME_LIMIT_MS]). */
  timeLimitMs?: number;
  /** Per-stream output cap in bytes. */
  maxOutputBytes?: number;
};

export function clampTimeLimit(n: number | undefined): number {
  const v = n ?? DEFAULT_TIME_LIMIT_MS;
  if (!Number.isFinite(v)) return DEFAULT_TIME_LIMIT_MS;
  return Math.min(MAX_TIME_LIMIT_MS, Math.max(100, Math.floor(v)));
}

/**
 * Run a compiled binary, feeding `input` on stdin and capturing stdout/stderr.
 * Enforces a wall-clock time limit (SIGKILL on timeout → timedOut) and caps
 * output size. Never throws — spawn failures surface via `spawnError`.
 */
export function runBinary(
  binPath: string,
  opts: RunOptions = {},
): Promise<RunResult> {
  const timeLimitMs = clampTimeLimit(opts.timeLimitMs);
  const maxOut = opts.maxOutputBytes ?? MAX_OUTPUT_BYTES;

  return new Promise<RunResult>((resolve) => {
    const start = process.hrtime.bigint();
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;
    let spawnError: string | undefined;
    let exitCode: number | null = null;
    let signal: string | null = null;

    let child;
    try {
      child = spawn(binPath, opts.args ?? [], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: path.dirname(binPath),
        windowsHide: true,
      });
    } catch (e) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        signal: null,
        timedOut: false,
        timeMs: ms,
        truncated: false,
        spawnError: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeLimitMs);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const timeMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
        exitCode,
        signal,
        timedOut,
        timeMs: Math.round(timeMs * 10) / 10,
        truncated,
        spawnError,
      });
    };

    child.on("error", (e: Error) => {
      spawnError = e.message;
      finish();
    });

    child.stdout.on("data", (d: Buffer) => {
      if (outLen >= maxOut) {
        // A chunk filled the cap exactly; anything after it is overflow.
        truncated = true;
        child.kill("SIGKILL");
        return;
      }
      const room = maxOut - outLen;
      if (d.length > room) {
        outChunks.push(d.subarray(0, room));
        outLen = maxOut;
        truncated = true;
        child.kill("SIGKILL");
      } else {
        outChunks.push(d);
        outLen += d.length;
      }
    });

    child.stderr.on("data", (d: Buffer) => {
      if (errLen >= maxOut) {
        truncated = true;
        return;
      }
      const room = maxOut - errLen;
      if (d.length > room) {
        errChunks.push(d.subarray(0, room));
        errLen = maxOut;
        truncated = true;
      } else {
        errChunks.push(d);
        errLen += d.length;
      }
    });

    child.on("close", (code: number | null, sig: NodeJS.Signals | null) => {
      exitCode = code;
      signal = sig;
      finish();
    });

    // Ignore EPIPE: the program may exit before consuming all of stdin.
    child.stdin.on("error", () => {});
    if (opts.input) {
      const buf = Buffer.from(opts.input, "utf8");
      child.stdin.write(
        buf.length > MAX_INPUT_BYTES ? buf.subarray(0, MAX_INPUT_BYTES) : buf,
      );
    }
    child.stdin.end();
  });
}

/** Classify a run as a judge verdict (without output comparison). */
export function runVerdict(run: RunResult): "OK" | "TLE" | "RE" {
  if (run.timedOut) return "TLE";
  if (run.spawnError || run.exitCode !== 0 || run.signal) return "RE";
  return "OK";
}

/** Program stderr plus any spawn error, for display. */
export function runStderr(run: RunResult): string {
  return run.spawnError
    ? `${run.stderr}\n${run.spawnError}`.trim()
    : run.stderr;
}

// ==================== Cleanup ====================

/** Best-effort recursive removal of a temp work directory. Never throws. */
export async function cleanup(
  workDir: string | null | undefined,
): Promise<void> {
  if (!workDir) return;
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch {
    // ignore — temp dirs are reclaimed by the OS eventually
  }
}
