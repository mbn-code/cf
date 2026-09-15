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
 *     compilerFlags?: string[] // extra flags (validated against an allowlist)
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,             // true when verdict === "OK"
 *     verdict: "OK"|"CE"|"RE"|"TLE",
 *     stdout: string,          // program stdout
 *     stderr: string,          // program stderr
 *     exitCode: number|null,   // program exit code
 *     signal: string|null,     // terminating signal, when killed
 *     timedOut: boolean,
 *     timeMs: number,          // run wall-clock time, measured in Node
 *     truncated: boolean,      // output hit the size cap
 *     compiler: string|null,
 *     compile: {
 *       ok: boolean, stderr: string, ms: number, cached: boolean,
 *       diagnostics: { severity, line, column, message }[],
 *       rejectedFlags: { flag, reason }[]
 *     }
 *   }
 * On a 400 the body is { error: string }.
 */

import { NextResponse } from "next/server";
import {
  compile,
  runBinary,
  cleanup,
  runVerdict,
  runStderr,
} from "../_engine/cpp";
import { readJson, badRequest, parseRunOptions, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;

  const code = str(body, "code");
  if (!code.trim()) return badRequest("Missing required field: code");

  const input =
    typeof body.input === "string"
      ? body.input
      : typeof body.stdin === "string"
        ? body.stdin
        : undefined;
  const opts = parseRunOptions(body);

  const compiled = await compile(code, {
    std: opts.std,
    extraFlags: opts.extraFlags,
    label: "run",
  });
  const compileBlock = {
    ok: compiled.ok,
    stderr: compiled.stderr,
    ms: Math.round(compiled.ms),
    cached: compiled.cached,
    diagnostics: compiled.diagnostics,
    rejectedFlags: compiled.rejectedFlags,
  };

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
      compile: compileBlock,
    });
  }

  const run = await runBinary(compiled.binPath, {
    input,
    timeLimitMs: opts.timeLimitMs,
  });
  const verdict = runVerdict(run);

  return NextResponse.json({
    ok: verdict === "OK",
    verdict,
    stdout: run.stdout,
    stderr: runStderr(run),
    exitCode: run.exitCode,
    signal: run.signal,
    timedOut: run.timedOut,
    timeMs: run.timeMs,
    truncated: run.truncated,
    compiler: compiled.compiler,
    compile: compileBlock,
  });
}
