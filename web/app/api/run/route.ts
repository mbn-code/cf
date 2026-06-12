/**
 * POST /api/run — compile a single C++ source and run it once.
 *
 * Request JSON:
 *   {
 *     code: string,            // C++ source to compile (required)
 *     input?: string,          // data fed to the program's stdin
 *     stdin?: string,          // alias for `input`
 *     timeLimitMs?: number,    // wall-clock limit, default 5000, max 60000
 *     std?: string,            // C++ standard sans -std=, default "gnu++17"
 *     compilerFlags?: string[] // extra flags appended to the compile command
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,             // true when verdict === "OK"
 *     verdict: "OK"|"CE"|"RE"|"TLE",
 *     stdout: string,          // program stdout (backward-compatible field)
 *     stderr: string,          // program stderr (backward-compatible field)
 *     exitCode: number|null,   // program exit code (backward-compatible field)
 *     signal: string|null,     // terminating signal, when killed
 *     timedOut: boolean,
 *     timeMs: number,          // run wall-clock time, measured in Node
 *     truncated: boolean,      // output hit the size cap
 *     compiler: string|null,
 *     compile: { ok: boolean, stderr: string, ms: number }
 *   }
 * On a 400 the body is { error: string }.
 */

import { NextResponse } from "next/server";
import { compile, runBinary, cleanup, type RunResult } from "../_engine/cpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json(
      { error: "Missing required field: code" },
      { status: 400 },
    );
  }

  const input =
    typeof body.input === "string"
      ? body.input
      : typeof body.stdin === "string"
        ? body.stdin
        : undefined;
  const timeLimitMs =
    typeof body.timeLimitMs === "number" ? body.timeLimitMs : undefined;
  const std = typeof body.std === "string" ? body.std : undefined;
  const extraFlags = Array.isArray(body.compilerFlags)
    ? body.compilerFlags.filter((f): f is string => typeof f === "string")
    : undefined;

  const compiled = await compile(code, { std, extraFlags, label: "run" });
  if (!compiled.ok || !compiled.binPath) {
    await cleanup(compiled.workDir);
    return NextResponse.json({
      ok: false,
      verdict: "CE",
      stdout: "",
      stderr: compiled.stderr,
      exitCode: null,
      signal: null,
      timedOut: false,
      timeMs: 0,
      truncated: false,
      compiler: compiled.compiler,
      compile: { ok: false, stderr: compiled.stderr, ms: compiled.ms },
    });
  }

  let run: RunResult;
  try {
    run = await runBinary(compiled.binPath, { input, timeLimitMs });
  } finally {
    await cleanup(compiled.workDir);
  }

  const verdict = run.timedOut
    ? "TLE"
    : run.spawnError || run.exitCode !== 0 || run.signal
      ? "RE"
      : "OK";

  return NextResponse.json({
    ok: verdict === "OK",
    verdict,
    stdout: run.stdout,
    stderr: run.spawnError
      ? `${run.stderr}\n${run.spawnError}`.trim()
      : run.stderr,
    exitCode: run.exitCode,
    signal: run.signal,
    timedOut: run.timedOut,
    timeMs: run.timeMs,
    truncated: run.truncated,
    compiler: compiled.compiler,
    compile: { ok: true, stderr: compiled.stderr, ms: compiled.ms },
  });
}
