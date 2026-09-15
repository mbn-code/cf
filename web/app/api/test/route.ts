/**
 * POST /api/test — compile C++ once and run it against many test cases.
 *
 * Request JSON:
 *   {
 *     code: string,                          // C++ source (required)
 *     tests: { input: string, expected: string }[],  // cases (required)
 *     timeLimitMs?: number,                  // per-case limit, default 5000
 *     std?: string,                          // C++ standard, default gnu++17
 *     compilerFlags?: string[],              // validated against an allowlist
 *     checker?: "lines"|"tokens"|"float",    // comparison mode, default lines
 *     epsilon?: number,                      // float checker tolerance
 *     stopOnFirstFailure?: boolean           // skip remaining cases after a non-AC
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,                           // true when every case is AC
 *     compiler: string|null,
 *     compile: { ok, stderr, ms, cached, diagnostics, rejectedFlags },
 *     checker: "lines"|"tokens"|"float",
 *     summary: { total, passed, failed, skipped, verdict, maxTimeMs, totalTimeMs },
 *     results: Array<{
 *       index: number,
 *       verdict: "AC"|"WA"|"TLE"|"RE"|"CE"|"SKIPPED",
 *       input: string,
 *       expected: string,
 *       actual: string,                      // program stdout
 *       stderr: string,
 *       exitCode: number|null,
 *       signal: string|null,
 *       timeMs: number,
 *       truncated: boolean,
 *       presentationOnly: boolean,           // WA only: tokens match, layout differs
 *       diff: Array<{ line, expected, actual, same }>  // differing lines, WA only
 *     }>
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
import { compareOutputs } from "../_engine/compare";
import { normalizeTests } from "../_engine/store";
import { readJson, badRequest, parseRunOptions, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "SKIPPED";

// Worst-of ordering for the overall summary verdict.
const SEVERITY: Record<Verdict, number> = {
  AC: 0,
  SKIPPED: 0,
  WA: 1,
  TLE: 2,
  RE: 3,
  CE: 4,
};

const MAX_TESTS = 200;

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;

  const code = str(body, "code");
  if (!code.trim()) return badRequest("Missing required field: code");

  const tests = normalizeTests(body.tests);
  if (tests.length === 0)
    return badRequest("Provide at least one test case in `tests`");
  if (tests.length > MAX_TESTS)
    return badRequest(`At most ${MAX_TESTS} test cases per request`);

  const opts = parseRunOptions(body);
  const stopOnFirstFailure = body.stopOnFirstFailure === true;

  const compiled = await compile(code, {
    std: opts.std,
    extraFlags: opts.extraFlags,
    label: "test",
  });
  const compileBlock = {
    ok: compiled.ok,
    stderr: compiled.stderr,
    ms: Math.round(compiled.ms),
    cached: compiled.cached,
    diagnostics: compiled.diagnostics,
    rejectedFlags: compiled.rejectedFlags,
  };

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
      presentationOnly: false,
      diff: [],
    }));
    return NextResponse.json({
      ok: false,
      compiler: compiled.compiler,
      compile: compileBlock,
      checker: opts.checker,
      summary: {
        total: tests.length,
        passed: 0,
        failed: tests.length,
        skipped: 0,
        verdict: "CE",
        maxTimeMs: 0,
        totalTimeMs: 0,
      },
      results,
    });
  }

  const results = [];
  let failedSoFar = false;
  for (let index = 0; index < tests.length; index++) {
    const t = tests[index];
    if (stopOnFirstFailure && failedSoFar) {
      results.push({
        index,
        verdict: "SKIPPED" as Verdict,
        input: t.input,
        expected: t.expected,
        actual: "",
        stderr: "",
        exitCode: null,
        signal: null,
        timeMs: 0,
        truncated: false,
        presentationOnly: false,
        diff: [],
      });
      continue;
    }

    const run = await runBinary(compiled.binPath, {
      input: t.input,
      timeLimitMs: opts.timeLimitMs,
    });

    let verdict: Verdict;
    let diff: ReturnType<typeof compareOutputs>["diff"] = [];
    let presentationOnly = false;
    const rv = runVerdict(run);
    if (rv !== "OK") {
      verdict = rv;
    } else {
      const cmp = compareOutputs(t.expected, run.stdout, {
        mode: opts.checker,
        epsilon: opts.epsilon,
      });
      verdict = cmp.match ? "AC" : "WA";
      diff = cmp.diff;
      presentationOnly = !!cmp.presentationOnly;
    }
    if (verdict !== "AC") failedSoFar = true;

    results.push({
      index,
      verdict,
      input: t.input,
      expected: t.expected,
      actual: run.stdout,
      stderr: runStderr(run),
      exitCode: run.exitCode,
      signal: run.signal,
      timeMs: run.timeMs,
      truncated: run.truncated,
      presentationOnly,
      diff,
    });
  }

  const passed = results.filter((r) => r.verdict === "AC").length;
  const skipped = results.filter((r) => r.verdict === "SKIPPED").length;
  const worst = results.reduce<Verdict>(
    (acc, r) => (SEVERITY[r.verdict] > SEVERITY[acc] ? r.verdict : acc),
    "AC",
  );
  const maxTimeMs = results.reduce((m, r) => Math.max(m, r.timeMs), 0);
  const totalTimeMs = results.reduce((s, r) => s + r.timeMs, 0);

  return NextResponse.json({
    ok: passed === results.length,
    compiler: compiled.compiler,
    compile: compileBlock,
    checker: opts.checker,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed - skipped,
      skipped,
      verdict: worst,
      maxTimeMs: Math.round(maxTimeMs * 10) / 10,
      totalTimeMs: Math.round(totalTimeMs * 10) / 10,
    },
    results,
  });
}
