/**
 * /api/problems — persist saved problems and their test cases as JSON under
 * <web>/data/problems/<slug>.json. Uses only Node built-ins.
 *
 * GET  /api/problems              → { problems: ProblemSummary[] }   (newest first)
 * GET  /api/problems?name=<n|slug>→ { problem: Problem } | 404 { error }
 * POST /api/problems
 *        { name, code?, statement?, tests? }   → { ok, problem }     (upsert)
 *        { op: "rename", from, to }            → { ok, problem }      (rename)
 * DELETE /api/problems?name=<n|slug>           → { ok, deleted }
 *
 * Types:
 *   TestCase       = { input: string, expected: string }
 *   Problem        = { name, slug, code, statement, tests: TestCase[],
 *                      createdAt, updatedAt }
 *   ProblemSummary = { name, slug, testCount, updatedAt }
 *
 * `slug` is derived from `name` (lowercase, non-alphanumerics → "-") and is the
 * stable key; saving with the same name updates the existing record.
 */

import { NextResponse } from "next/server";
import {
  listProblems,
  getProblem,
  saveProblem,
  deleteProblem,
  renameProblem,
  slugify,
} from "../_engine/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveSlug(key: string): string {
  // Accept either an exact slug or a human name; slugify is idempotent on slugs.
  return /^[a-z0-9-]+$/.test(key) ? key : slugify(key);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (name) {
    const problem =
      (await getProblem(resolveSlug(name))) ??
      (await getProblem(slugify(name)));
    if (!problem) {
      return NextResponse.json(
        { error: `Problem not found: ${name}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ problem });
  }
  const problems = await listProblems();
  return NextResponse.json({ problems });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.op === "rename") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (!from || !to.trim()) {
      return NextResponse.json(
        { error: "rename requires `from` and `to`" },
        { status: 400 },
      );
    }
    const problem = await renameProblem(resolveSlug(from), to.trim());
    if (!problem) {
      return NextResponse.json(
        { error: `Problem not found: ${from}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, problem });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 },
    );
  }

  const problem = await saveProblem({
    name: name.trim(),
    code: typeof body.code === "string" ? body.code : undefined,
    statement: typeof body.statement === "string" ? body.statement : undefined,
    tests: body.tests,
  });
  return NextResponse.json({ ok: true, problem });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json(
      { error: "Missing required query param: name" },
      { status: 400 },
    );
  }
  const deleted =
    (await deleteProblem(resolveSlug(name))) ||
    (await deleteProblem(slugify(name)));
  return NextResponse.json({ ok: true, deleted });
}
