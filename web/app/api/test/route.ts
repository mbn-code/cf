/**
 * POST /api/test — compile C++ once and run it against many test cases.
 *
 * Request JSON:
 *   {
 *     code: string,                          // C++ source (required)
 *     tests: { input: string, expected: string }[],  // cases (required)
 *     timeLimitMs?: number,                  // per-case limit, default 5000
 *     std?: string,                          // C++ standard, default gnu++17
 *     compilerFlags?: string[]
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,                           // true when every case is AC
 *     compiler: string|null,
 *     compile: { ok: boolean, stderr: string, ms: number },
 *     summary: { total, passed, failed, verdict },  // verdict is worst-of
 *     results: Array<{
 *       index: number,
 *       verdict: "AC"|"WA"|"TLE"|"RE"|"CE",
 *       input: string,
 *       expected: string,
 *       actual: string,                      // program stdout
 *       stderr: string,
 *       exitCode: number|null,
 *       signal: string|null,
 *       timeMs: number,
 *       truncated: boolean,
 *       diff: Array<{ line, expected, actual, same }>  // differing lines, WA only
 *     }>
 *   }
 * On a 400 the body is { error: string }.
 *
 * Comparison is trailing-whitespace tolerant (see _engine/compare).
 */

import { NextResponse } from "next/server";
import { compile, runBinary, cleanup } from "../_engine/cpp";
import { compareOutputs } from "../_engine/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";

// Worst-of ordering for the overall summary verdict.
const SEVERITY: Record<Verdict, number> = {
  AC: 0,
  WA: 1,
  TLE: 2,
  RE: 3,
  CE: 4,
};

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

  const tests = Array.isArray(body.tests)
    ? body.tests
        .filter(
          (t): t is Record<string, unknown> => !!t && typeof t === "object",
        )
        .map((t) => ({
          input: typeof t.input === "string" ? t.input : "",
          expected: typeof t.expected === "string" ? t.expected : "",
        }))
    : [];

  if (tests.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one test case in `tests`" },
      { status: 400 },
    );
  }

  const timeLimitMs =
    typeof body.timeLimitMs === "number" ? body.timeLimitMs : undefined;
  const std = typeof body.std === "string" ? body.std : undefined;
  const extraFlags = Array.isArray(body.compilerFlags)
    ? body.compilerFlags.filter((f): f is string => typeof f === "string")
    : undefined;

  const compiled = await compile(code, { std, extraFlags, label: "test" });

  // Compile error → every case reports CE so the UI can badge each row.
  if (!compiled.ok || !compiled.binPath) {
    await cleanup(compiled.workDir);
    const results = tests.map((t, index) => ({
      index,
      verdict: "CE" as Verdict,
      input: t.input,
      expected: t.expected,
      actual: "",
      stderr: compiled.stderr,
      exitCode: null,
      signal: null,
      timeMs: 0,
      truncated: false,
      diff: [],
    }));
    return NextResponse.json({
      ok: false,
      compiler: compiled.compiler,
      compile: { ok: false, stderr: compiled.stderr, ms: compiled.ms },
      summary: {
        total: tests.length,
        passed: 0,
        failed: tests.length,
        verdict: "CE",
      },
      results,
    });
  }

  const results = [];
  try {
    for (let index = 0; index < tests.length; index++) {
      const t = tests[index];
      const run = await runBinary(compiled.binPath, {
        input: t.input,
        timeLimitMs,
      });

      let verdict: Verdict;
      let diff: ReturnType<typeof compareOutputs>["diff"] = [];
      if (run.timedOut) {
        verdict = "TLE";
      } else if (run.spawnError || run.exitCode !== 0 || run.signal) {
        verdict = "RE";
      } else {
        const cmp = compareOutputs(t.expected, run.stdout);
        verdict = cmp.match ? "AC" : "WA";
        diff = cmp.diff;
      }

      results.push({
        index,
        verdict,
        input: t.input,
        expected: t.expected,
        actual: run.stdout,
        stderr: run.spawnError
          ? `${run.stderr}\n${run.spawnError}`.trim()
          : run.stderr,
        exitCode: run.exitCode,
        signal: run.signal,
        timeMs: run.timeMs,
        truncated: run.truncated,
        diff,
      });
    }
  } finally {
    await cleanup(compiled.workDir);
  }

  const passed = results.filter((r) => r.verdict === "AC").length;
  const worst = results.reduce<Verdict>(
    (acc, r) => (SEVERITY[r.verdict] > SEVERITY[acc] ? r.verdict : acc),
    "AC",
  );

  return NextResponse.json({
    ok: passed === results.length,
    compiler: compiled.compiler,
    compile: { ok: true, stderr: compiled.stderr, ms: compiled.ms },
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      verdict: worst,
    },
    results,
  });
}
