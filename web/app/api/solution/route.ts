/**
 * /api/solution — load/save a per-problem solution.cpp in the repo `src` tree.
 *
 * GET  /api/solution?problem=<name>  → { code: string }   ("" when absent)
 * POST /api/solution  { problem, code } → { success: true }
 *
 * `problem` must be a single safe path segment (letters, digits, `_`, `-`,
 * `.`); anything else is rejected with 400 so the route can never read or
 * write outside the problems directory.
 */

import { NextResponse } from "next/server";
import { getSolution, saveSolution, isSafeProblemName } from "../_engine/store";
import { readJson, badRequest, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CODE_BYTES = 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get("problem");
  if (!isSafeProblemName(problem)) return badRequest("Invalid problem name");
  const code = await getSolution(problem);
  return NextResponse.json({ code });
}

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const problem = str(body, "problem");
  if (!isSafeProblemName(problem)) return badRequest("Invalid problem name");
  const code = str(body, "code");
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES)
    return badRequest("Source is too large");
  await saveSolution(problem, code);
  return NextResponse.json({ success: true });
}
