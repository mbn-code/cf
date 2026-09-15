/**
 * POST /api/samples — parse a pasted problem statement into sample tests.
 *
 * Request JSON:  { statement: string }
 * Response JSON: {
 *   title: string|null,          // first non-empty line ("A. Team")
 *   timeLimitMs: number|null,    // from "time limit per test 2 seconds"
 *   memoryLimitMb: number|null,  // from "memory limit per test 256 megabytes"
 *   tests: { input: string, expected: string }[]
 * }
 * On a 400 the body is { error: string }.
 */

import { NextResponse } from "next/server";
import { parseStatement } from "../_engine/statement";
import { readJson, badRequest, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATEMENT_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const statement = str(body, "statement");
  if (!statement.trim()) return badRequest("Missing required field: statement");
  if (Buffer.byteLength(statement, "utf8") > MAX_STATEMENT_BYTES)
    return badRequest("Statement is too large");
  return NextResponse.json(parseStatement(statement));
}
