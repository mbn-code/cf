/**
 * /api/problem-text — load/save a per-problem statement (problem.txt) in `src`.
 *
 * GET  /api/problem-text?problem=<name> → { text: string }  ("" when absent)
 * POST /api/problem-text  { problem, text } → { success: true }
 *
 * `problem` must be a single safe path segment; see /api/solution.
 */

import { NextResponse } from "next/server";
import {
  getProblemText,
  saveProblemText,
  isSafeProblemName,
} from "../_engine/store";
import { readJson, badRequest, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_BYTES = 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get("problem");
  if (!isSafeProblemName(problem)) return badRequest("Invalid problem name");
  const text = await getProblemText(problem);
  return NextResponse.json({ text });
}

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const problem = str(body, "problem");
  if (!isSafeProblemName(problem)) return badRequest("Invalid problem name");
  const text = str(body, "text");
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES)
    return badRequest("Statement is too large");
  await saveProblemText(problem, text);
  return NextResponse.json({ success: true });
}
