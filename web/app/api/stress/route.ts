/**
 * POST /api/stress — stress-test a solution against a brute force.
 *
 * Compiles three C++ sources, then repeatedly: runs `generator <seed>` to make
 * an input, feeds that input to both `solution` and `brute`, and compares their
 * outputs (trailing-whitespace tolerant). Returns the first input on which they
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
 *     std?: string             // C++ standard, default gnu++17
 *   }
 *
 * Response JSON (200):
 *   {
 *     ok: boolean,                 // compiled & ran (not whether a bug was found)
 *     failed: boolean,             // true when a counter-example was found
 *     iterationsRun: number,
 *     compile: {                   // per-source compile status
 *       solution: { ok, stderr, ms },
 *       brute:    { ok, stderr, ms },
 *       generator:{ ok, stderr, ms }
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
  type CompileResult,
} from "../_engine/cpp";
import { compareOutputs } from "../_engine/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITERATIONS = 5000;
// Overall wall-clock budget so a slow brute force can't hang a request forever.
const TOTAL_DEADLINE_MS = 30_000;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const solution = typeof body.solution === "string" ? body.solution : "";
  const brute = typeof body.brute === "string" ? body.brute : "";
  const generator = typeof body.generator === "string" ? body.generator : "";
  if (!solution.trim() || !brute.trim() || !generator.trim()) {
    return NextResponse.json(
      {
        error: "Provide non-empty `solution`, `brute` and `generator` sources",
      },
      { status: 400 },
    );
  }

  const iterations = clampInt(body.iterations, 100, 1, MAX_ITERATIONS);
  const timeLimitMs =
    typeof body.timeLimitMs === "number" ? body.timeLimitMs : undefined;
  const seedBase = clampInt(body.seedBase, 1, 0, Number.MAX_SAFE_INTEGER);
  const std = typeof body.std === "string" ? body.std : undefined;

  const [cs, cb, cg] = await Promise.all([
    compile(solution, { std, label: "sol" }),
    compile(brute, { std, label: "brute" }),
    compile(generator, { std, label: "gen" }),
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
      compile: compileBlock,
      message: `Compilation failed for ${which}.`,
    });
  }

  const start = process.hrtime.bigint();
  let iterationsRun = 0;
  let firstFailure: Record<string, unknown> | undefined;

  try {
    for (let i = 0; i < iterations; i++) {
      if (Number(process.hrtime.bigint() - start) / 1e6 > TOTAL_DEADLINE_MS)
        break;
      iterationsRun = i + 1;
      const seed = seedBase + i;

      const gen = await runBinary(cg.binPath, {
        args: [String(seed)],
        timeLimitMs,
      });
      if (gen.timedOut || gen.spawnError || gen.exitCode !== 0 || gen.signal) {
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
        runBinary(cs.binPath, { input, timeLimitMs }),
        runBinary(cb.binPath, { input, timeLimitMs }),
      ]);

      const solBad =
        solRun.timedOut ||
        solRun.spawnError ||
        solRun.exitCode !== 0 ||
        solRun.signal;
      const bruteBad =
        bruteRun.timedOut ||
        bruteRun.spawnError ||
        bruteRun.exitCode !== 0 ||
        bruteRun.signal;

      if (solBad || bruteBad) {
        const reason = solRun.timedOut
          ? "solution-tle"
          : bruteRun.timedOut
            ? "brute-tle"
            : solBad
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

      const cmp = compareOutputs(bruteRun.stdout, solRun.stdout);
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
  } finally {
    await Promise.all([
      cleanup(cs.workDir),
      cleanup(cb.workDir),
      cleanup(cg.workDir),
    ]);
  }

  return NextResponse.json({
    ok: true,
    failed: !!firstFailure,
    iterationsRun,
    compile: compileBlock,
    firstFailure,
    message: firstFailure
      ? `Found a counter-example on iteration ${firstFailure.iteration}.`
      : `No counter-example found in ${iterationsRun} iteration(s).`,
  });
}

function toCompileStatus(c: CompileResult) {
  return { ok: c.ok, stderr: c.stderr, ms: c.ms };
}

function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === "number" ? Math.floor(v) : def;
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}
