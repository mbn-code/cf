/**
 * /api/problem-text — load/save a per-problem statement (problem.txt) in `src`.
 *
 * GET  /api/problem-text?problem=<name> → { text: string }  ("" when absent)
 * POST /api/problem-text  { problem, text } → { success: true }
 *
 * Self-contained (Node built-ins only) so the api tree never imports web/lib.
 */

import { NextResponse } from "next/server";
import { getProblemText, saveProblemText } from "../_engine/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get("problem");
  if (!problem)
    return NextResponse.json({ error: "Missing problem" }, { status: 400 });
  const text = await getProblemText(problem);
  return NextResponse.json({ text });
}

export async function POST(request: Request) {
  const { problem, text } = await request.json();
  if (!problem)
    return NextResponse.json({ error: "Missing problem" }, { status: 400 });
  await saveProblemText(problem, typeof text === "string" ? text : "");
  return NextResponse.json({ success: true });
}
