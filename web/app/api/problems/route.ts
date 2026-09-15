/**
 * /api/problems — persist saved problems as JSON under
 * <web>/data/problems/<slug>.json. Uses only Node built-ins.
 *
 * GET  /api/problems                 → { problems: ProblemSummary[] }   (newest first)
 * GET  /api/problems?name=<n|slug>   → { problem: Problem } | 404 { error }
 * GET  /api/problems?export=1        → { version: 1, exportedAt, problems: Problem[] }
 * POST /api/problems
 *        { name, code?, statement?, tests?, stdin?, brute?, generator?, settings? }
 *                                     → { ok, problem }      (upsert)
 *        { op: "rename", from, to }   → { ok, problem }      (rename)
 *        { op: "duplicate", from, to }→ { ok, problem }      (copy)
 *        { op: "import", problems: Problem[], overwrite?: boolean }
 *                                     → { ok, imported, skipped }
 * DELETE /api/problems?name=<n|slug>  → { ok, deleted }
 *
 * Types:
 *   TestCase       = { input: string, expected: string }
 *   Problem        = { name, slug, code, statement, tests: TestCase[], stdin,
 *                      brute, generator, settings|null, createdAt, updatedAt }
 *   ProblemSummary = { name, slug, testCount, updatedAt }
 *
 * `slug` is derived from `name` (lowercase, non-alphanumerics → "-") and is the
 * stable key; saving with the same name updates the existing record.
 */

import { NextResponse } from "next/server";
import {
  listProblems,
  listProblemsFull,
  getProblem,
  saveProblem,
  deleteProblem,
  renameProblem,
  duplicateProblem,
  importProblems,
  slugify,
} from "../_engine/store";
import { readJson, badRequest, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 120;

function resolveSlug(key: string): string {
  // Accept either an exact slug or a human name; slugify is idempotent on slugs.
  return /^[a-z0-9-]+$/.test(key) ? key : slugify(key);
}

function notFound(name: string) {
  return NextResponse.json(
    { error: `Problem not found: ${name}` },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (name) {
    const problem =
      (await getProblem(resolveSlug(name))) ??
      (await getProblem(slugify(name)));
    if (!problem) return notFound(name);
    return NextResponse.json({ problem });
  }
  if (searchParams.get("export")) {
    const problems = await listProblemsFull();
    return NextResponse.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      problems,
    });
  }
  const problems = await listProblems();
  return NextResponse.json({ problems });
}

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;

  const op = str(body, "op");

  if (op === "rename" || op === "duplicate") {
    const from = str(body, "from");
    const to = str(body, "to").trim();
    if (!from || !to) return badRequest(`${op} requires \`from\` and \`to\``);
    if (to.length > MAX_NAME) return badRequest("Problem name is too long");
    const problem =
      op === "rename"
        ? await renameProblem(resolveSlug(from), to)
        : await duplicateProblem(resolveSlug(from), to);
    if (!problem) return notFound(from);
    return NextResponse.json({ ok: true, problem });
  }

  if (op === "import") {
    const result = await importProblems(body.problems, body.overwrite === true);
    return NextResponse.json({ ok: true, ...result });
  }

  if (op) return badRequest(`Unknown op: ${op}`);

  const name = str(body, "name").trim();
  if (!name) return badRequest("Missing required field: name");
  if (name.length > MAX_NAME) return badRequest("Problem name is too long");

  const problem = await saveProblem({
    name,
    code: typeof body.code === "string" ? body.code : undefined,
    statement: typeof body.statement === "string" ? body.statement : undefined,
    tests: body.tests,
    stdin: typeof body.stdin === "string" ? body.stdin : undefined,
    brute: typeof body.brute === "string" ? body.brute : undefined,
    generator: typeof body.generator === "string" ? body.generator : undefined,
    settings: body.settings,
  });
  return NextResponse.json({ ok: true, problem });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return badRequest("Missing required query param: name");
  const deleted =
    (await deleteProblem(resolveSlug(name))) ||
    (await deleteProblem(slugify(name)));
  return NextResponse.json({ ok: true, deleted });
}
