/**
 * POST /api/stress — stress-test a solution against a brute force.
 *
 * Compiles three C++ sources, then repeatedly: runs `generator <seed>` to make
 * an input, feeds that input to both `solution` and `brute`, and compares their
 * outputs under the chosen checker. Returns the first input on which they
 * disagree (or on which a program crashes / times out).
 *
 * The generator receives the iteration seed as argv[1] so runs are reproducible.
 *
 * Request JSON:
 *   {
 *     solution: string,        // candidate C++ source (required)
 *     brute: string,           // reference/brute C++ source (required)
 *     generator: string,       // input generator C++ source (required)
 *     iterations?: number,     // rounds to run, default 100, max 5000
 *     timeLimitMs?: number,    // per-program limit, default 5000
 *     seedBase?: number,       // first seed, default 1
 *     std?: string,            // C++ standard, default gnu++17
 *     compilerFlags?: string[],
 *     checker?: "lines"|"tokens"|"float",
 *     epsilon?: number
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,                 // compiled & ran (not whether a bug was found)
 *     failed: boolean,             // true when a counter-example was found
 *     iterationsRun: number,
 *     elapsedMs: number,           // wall-clock time spent iterating
 *     deadlineHit: boolean,        // true when the request budget cut the search short
 *     stats: { maxSolutionMs, maxBruteMs, avgSolutionMs },
 *     compile: {                   // per-source compile status
 *       solution: { ok, stderr, ms, cached, diagnostics },
 *       brute:    { ok, stderr, ms, cached, diagnostics },
 *       generator:{ ok, stderr, ms, cached, diagnostics }
 *     },
 *     firstFailure?: {
 *       iteration: number,
 *       seed: number,
 *       reason: "mismatch"|"solution-error"|"brute-error"|"solution-tle"|"brute-tle"|"generator-error",
 *       input: string,
 *       solutionOutput: string,
 *       bruteOutput: string,
 *       diff: Array<{ line, expected, actual, same }>
 *     },
 *     message: string
 *   }
 * On a 400 the body is { error: string }. A compile failure returns 200 with
 * ok:false and the offending compile.stderr populated.
 */

import { NextResponse } from "next/server";
import {
  compile,
  runBinary,
  cleanup,
  runVerdict,
  type CompileResult,
} from "../_engine/cpp";
import { compareOutputs } from "../_engine/compare";
import { readJson, badRequest, parseRunOptions, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITERATIONS = 5000;
// Overall wall-clock budget so a slow brute force can't hang a request forever.
const TOTAL_DEADLINE_MS = 60_000;

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;

  const solution = str(body, "solution");
  const brute = str(body, "brute");
  const generator = str(body, "generator");
  if (!solution.trim() || !brute.trim() || !generator.trim()) {
    return badRequest(
      "Provide non-empty `solution`, `brute` and `generator` sources",
    );
  }

  const iterations = clampInt(body.iterations, 100, 1, MAX_ITERATIONS);
  const seedBase = clampInt(body.seedBase, 1, 0, Number.MAX_SAFE_INTEGER);
  const opts = parseRunOptions(body);
  const compileOpts = { std: opts.std, extraFlags: opts.extraFlags };

  const [cs, cb, cg] = await Promise.all([
    compile(solution, { ...compileOpts, label: "sol" }),
    compile(brute, { ...compileOpts, label: "brute" }),
    compile(generator, { ...compileOpts, label: "gen" }),
  ]);

  const compileBlock = {
    solution: toCompileStatus(cs),
    brute: toCompileStatus(cb),
    generator: toCompileStatus(cg),
  };

  if (!cs.ok || !cb.ok || !cg.ok || !cs.binPath || !cb.binPath || !cg.binPath) {
    await Promise.all([
      cleanup(cs.workDir),
      cleanup(cb.workDir),
      cleanup(cg.workDir),
    ]);
    const which = !cs.ok ? "solution" : !cb.ok ? "brute" : "generator";
    return NextResponse.json({
      ok: false,
      failed: false,
      iterationsRun: 0,
      elapsedMs: 0,
      deadlineHit: false,
      stats: { maxSolutionMs: 0, maxBruteMs: 0, avgSolutionMs: 0 },
      compile: compileBlock,
      message: `Compilation failed for ${which}.`,
    });
  }

  const start = process.hrtime.bigint();
  const elapsed = () => Number(process.hrtime.bigint() - start) / 1e6;
  let iterationsRun = 0;
  let deadlineHit = false;
  let maxSolutionMs = 0;
  let maxBruteMs = 0;
  let sumSolutionMs = 0;
  let firstFailure: Record<string, unknown> | undefined;

  for (let i = 0; i < iterations; i++) {
    if (elapsed() > TOTAL_DEADLINE_MS) {
      deadlineHit = true;
      break;
    }
    iterationsRun = i + 1;
    const seed = seedBase + i;

    const gen = await runBinary(cg.binPath, {
      args: [String(seed)],
      timeLimitMs: opts.timeLimitMs,
    });
    if (runVerdict(gen) !== "OK") {
      firstFailure = {
        iteration: i + 1,
        seed,
        reason: "generator-error",
        input: gen.stdout,
        solutionOutput: "",
        bruteOutput: "",
        diff: [],
        generatorStderr: gen.stderr,
      };
      break;
    }
    const input = gen.stdout;

    const [solRun, bruteRun] = await Promise.all([
      runBinary(cs.binPath, { input, timeLimitMs: opts.timeLimitMs }),
      runBinary(cb.binPath, { input, timeLimitMs: opts.timeLimitMs }),
    ]);
    maxSolutionMs = Math.max(maxSolutionMs, solRun.timeMs);
    maxBruteMs = Math.max(maxBruteMs, bruteRun.timeMs);
    sumSolutionMs += solRun.timeMs;

    const solV = runVerdict(solRun);
    const bruteV = runVerdict(bruteRun);
    if (solV !== "OK" || bruteV !== "OK") {
      const reason =
        solV === "TLE"
          ? "solution-tle"
          : bruteV === "TLE"
            ? "brute-tle"
            : solV !== "OK"
              ? "solution-error"
              : "brute-error";
      firstFailure = {
        iteration: i + 1,
        seed,
        reason,
        input,
        solutionOutput: solRun.stdout,
        bruteOutput: bruteRun.stdout,
        solutionStderr: solRun.stderr,
        bruteStderr: bruteRun.stderr,
        diff: [],
      };
      break;
    }

    const cmp = compareOutputs(bruteRun.stdout, solRun.stdout, {
      mode: opts.checker,
      epsilon: opts.epsilon,
    });
    if (!cmp.match) {
      firstFailure = {
        iteration: i + 1,
        seed,
        reason: "mismatch",
        input,
        solutionOutput: solRun.stdout,
        bruteOutput: bruteRun.stdout,
        diff: cmp.diff,
      };
      break;
    }
  }

  const elapsedMs = Math.round(elapsed());
  const message = firstFailure
    ? `Found a counter-example on iteration ${firstFailure.iteration}.`
    : deadlineHit
      ? `No counter-example in ${iterationsRun} iteration(s) before the ${TOTAL_DEADLINE_MS / 1000}s request budget ran out.`
      : `No counter-example found in ${iterationsRun} iteration(s).`;

  return NextResponse.json({
    ok: true,
    failed: !!firstFailure,
    iterationsRun,
    elapsedMs,
    deadlineHit,
    stats: {
      maxSolutionMs: round1(maxSolutionMs),
      maxBruteMs: round1(maxBruteMs),
      avgSolutionMs: round1(iterationsRun ? sumSolutionMs / iterationsRun : 0),
    },
    compile: compileBlock,
    firstFailure,
    message,
  });
}

function toCompileStatus(c: CompileResult) {
  return {
    ok: c.ok,
    stderr: c.stderr,
    ms: Math.round(c.ms),
    cached: c.cached,
    diagnostics: c.diagnostics,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === "number" ? Math.floor(v) : def;
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}
