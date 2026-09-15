/**
 * GET /api/config — environment and toolchain facts the UI displays.
 *
 * Response JSON:
 *   {
 *     version: string,               // workbench version (package.json)
 *     platform: string,              // process.platform
 *     compiler: string|null,         // detected compiler command
 *     compilerVersion: string|null,  // first line of `<compiler> --version`
 *     includeDir: string,            // where the bits/stdc++.h shim lives
 *     defaults: { std, timeLimitMs, maxTimeLimitMs, checker },
 *     limits: { maxSourceBytes, maxInputBytes, maxOutputBytes, compileTimeoutMs },
 *     cache: { entries: number },    // compiled binaries currently cached
 *     startProblem: string|null,     // CF_START_PROBLEM hint from `cf serve`
 *     problemsDir: string|null       // CF_PROBLEMS_DIR hint from `cf serve`
 *   }
 *
 * DELETE /api/config?cache=1 — drop every cached binary → { ok, cleared }.
 */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  detectCompiler,
  compilerVersion,
  includeDir,
  compileCacheSize,
  clearCompileCache,
  DEFAULT_STD,
  DEFAULT_TIME_LIMIT_MS,
  MAX_TIME_LIMIT_MS,
  MAX_SOURCE_BYTES,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  COMPILE_TIMEOUT_MS,
} from "../_engine/cpp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedVersion: string | null = null;

async function packageVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const raw = await readFile(
      path.join(process.cwd(), "package.json"),
      "utf8",
    );
    const v = (JSON.parse(raw) as { version?: unknown }).version;
    cachedVersion = typeof v === "string" ? v : "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion;
}

export async function GET() {
  return NextResponse.json({
    version: await packageVersion(),
    platform: process.platform,
    compiler: detectCompiler(),
    compilerVersion: compilerVersion(),
    includeDir: includeDir(),
    defaults: {
      std: DEFAULT_STD,
      timeLimitMs: DEFAULT_TIME_LIMIT_MS,
      maxTimeLimitMs: MAX_TIME_LIMIT_MS,
      checker: "lines",
    },
    limits: {
      maxSourceBytes: MAX_SOURCE_BYTES,
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      compileTimeoutMs: COMPILE_TIMEOUT_MS,
    },
    cache: { entries: compileCacheSize() },
    startProblem: process.env.CF_START_PROBLEM || null,
    problemsDir: process.env.CF_PROBLEMS_DIR || null,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!searchParams.get("cache")) {
    return NextResponse.json(
      { error: "Nothing to delete; pass ?cache=1 to clear the compile cache" },
      { status: 400 },
    );
  }
  const cleared = compileCacheSize();
  await clearCompileCache();
  return NextResponse.json({ ok: true, cleared });
}
