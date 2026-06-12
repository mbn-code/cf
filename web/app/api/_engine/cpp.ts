/**
 * web/app/api/_engine/cpp.ts
 *
 * Self-contained C++ compile/run engine for the cf workbench API routes.
 *
 * This module depends ONLY on Node.js built-ins (node:child_process, node:fs,
 * node:os, node:path) so the `web/app/api` tree never reaches into other
 * workspaces (e.g. web/lib). It powers /api/run, /api/test and /api/stress.
 *
 * Design notes:
 *  - The bundled portable `<bits/stdc++.h>` lives at <repoRoot>/include, so every
 *    compile passes `-I <repoRoot>/include` and the idiom resolves on macOS
 *    (clang/libc++) as well as Linux (g++/libstdc++).
 *  - Wall-clock time is measured inside Node with process.hrtime.bigint() around
 *    the spawn — never the shell `time` builtin (which is unreliable on macOS).
 *  - Every compilation happens in a unique os.tmpdir() directory so concurrent
 *    requests never collide, and temp dirs are always cleaned up by callers.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// ==================== Tunables ====================

/** Default C++ standard. `gnu++17` matches the project's validation command. */
export const DEFAULT_STD = "gnu++17";
/** Default per-run wall-clock limit (ms) before a program is killed as TLE. */
export const DEFAULT_TIME_LIMIT_MS = 5000;
/** Hard ceiling so a caller can never request an unbounded time limit. */
export const MAX_TIME_LIMIT_MS = 60_000;
/** Compilation is killed if it exceeds this (runaway template instantiation). */
export const COMPILE_TIMEOUT_MS = 30_000;
/** Largest stdin payload forwarded to a program. */
export const MAX_INPUT_BYTES = 4 * 1024 * 1024; // 4 MiB
/** Largest stdout/stderr captured per stream; excess is truncated. */
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024; // 4 MiB

/** Compiler candidates, in preference order: clang++/c++ (macOS) then g++. */
const COMPILER_CANDIDATES = ["clang++", "c++", "g++"];

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
      const probe = spawnSync(cand, ["--version"], { stdio: "ignore" });
      if (!probe.error && probe.status === 0) {
        cachedCompiler = cand;
        return cand;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// ==================== Compilation ====================

export type CompileResult = {
  /** True when the binary was produced with exit status 0. */
  ok: boolean;
  /** The compiler that was used, or null when none was found. */
  compiler: string | null;
  /** Compiler diagnostics (the "CE" text shown to the user). */
  stderr: string;
  /** Absolute path to the produced executable, or null on failure. */
  binPath: string | null;
  /** The unique temp directory holding the sources/binary; clean it up. */
  workDir: string | null;
  /** Compile wall-clock time in milliseconds. */
  ms: number;
  /** Machine-readable failure cause, when ok === false. */
  error?: "no-compiler" | "compile-timeout" | "compile-error" | "spawn-error";
};

export type CompileOptions = {
  /** C++ standard without the `-std=` prefix (default `gnu++17`). */
  std?: string;
  /** Extra compiler flags appended verbatim. */
  extraFlags?: string[];
  /** Short label used in the temp directory name. */
  label?: string;
};

/**
 * Compile a single C++ translation unit into a unique temp directory.
 * Never throws — failures are reported through the returned CompileResult.
 * Callers MUST cleanup(result.workDir) when finished with the binary.
 */
export async function compile(
  source: string,
  opts: CompileOptions = {},
): Promise<CompileResult> {
  const compiler = detectCompiler();
  if (!compiler) {
    return {
      ok: false,
      compiler: null,
      stderr:
        "No C++ compiler found. Tried clang++, c++ and g++. Install the Xcode " +
        "Command Line Tools (`xcode-select --install`) or a g++ toolchain.",
      binPath: null,
      workDir: null,
      ms: 0,
      error: "no-compiler",
    };
  }

  const workDir = await mkdtemp(
    path.join(os.tmpdir(), `cf-${opts.label ?? "build"}-`),
  );
  const srcPath = path.join(workDir, "main.cpp");
  const binPath = path.join(workDir, "prog");
  await writeFile(srcPath, source, "utf8");

  const args = [
    `-std=${opts.std ?? DEFAULT_STD}`,
    "-O2",
    "-I",
    includeDir(),
    srcPath,
    "-o",
    binPath,
    ...(opts.extraFlags ?? []),
  ];

  const start = process.hrtime.bigint();
  const res = spawnSync(compiler, args, {
    encoding: "utf8",
    timeout: COMPILE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  const timedOut =
    !!res.error && (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
  const ok = !res.error && res.status === 0;

  let stderr = res.stderr ?? "";
  if (res.error && !timedOut) stderr = `${stderr}\n${res.error.message}`.trim();
  if (timedOut) {
    stderr =
      `${stderr}\nCompilation timed out after ${COMPILE_TIMEOUT_MS} ms.`.trim();
  }

  return {
    ok,
    compiler,
    stderr,
    binPath: ok ? binPath : null,
    workDir,
    ms,
    error: ok
      ? undefined
      : timedOut
        ? "compile-timeout"
        : res.error
          ? "spawn-error"
          : "compile-error",
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

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
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
  const timeLimitMs = clamp(
    opts.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
    100,
    MAX_TIME_LIMIT_MS,
  );
  const maxOut = opts.maxOutputBytes ?? MAX_OUTPUT_BYTES;

  return new Promise<RunResult>((resolve) => {
    const start = process.hrtime.bigint();
    let stdout = "";
    let stderr = "";
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
        stdout,
        stderr,
        exitCode,
        signal,
        timedOut,
        timeMs,
        truncated,
        spawnError,
      });
    };

    child.on("error", (e: Error) => {
      spawnError = e.message;
      finish();
    });

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length >= maxOut) return;
      stdout += d.toString("utf8");
      if (stdout.length >= maxOut) {
        stdout = stdout.slice(0, maxOut);
        truncated = true;
        child.kill("SIGKILL");
      }
    });

    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length >= maxOut) return;
      stderr += d.toString("utf8");
      if (stderr.length >= maxOut) {
        stderr = stderr.slice(0, maxOut);
        truncated = true;
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
