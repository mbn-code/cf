/**
 * /api/solution — load/save a per-problem solution.cpp in the repo `src` tree.
 *
 * GET  /api/solution?problem=<name>  → { code: string }   ("" when absent)
 * POST /api/solution  { problem, code } → { success: true }
 *
 * Self-contained (Node built-ins only) so the api tree never imports web/lib.
 */

import { NextResponse } from "next/server";
import { getSolution, saveSolution } from "../_engine/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problem = searchParams.get("problem");
  if (!problem)
    return NextResponse.json({ error: "Missing problem" }, { status: 400 });
  const code = await getSolution(problem);
  return NextResponse.json({ code });
}

export async function POST(request: Request) {
  const { problem, code } = await request.json();
  if (!problem)
    return NextResponse.json({ error: "Missing problem" }, { status: 400 });
  await saveSolution(problem, typeof code === "string" ? code : "");
  return NextResponse.json({ success: true });
}
