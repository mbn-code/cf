/**
 * POST /api/template — fetch a named starter template from `templates/<name>.cpp`.
 *
 * Request:  { name: string }     // e.g. "dp", "graph", "math"
 * Response: { stdout: string, stderr: string, exitCode: number, content: string }
 *           `stdout` and `content` both hold the template text (stdout kept for
 *           backward compatibility). On a miss: exitCode 1 and an error stderr.
 *
 * Self-contained (Node built-ins only) so the api tree never imports web/lib.
 */

import { NextResponse } from "next/server";
import { readTemplate } from "../_engine/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { name } = await request.json();
  const content = await readTemplate(typeof name === "string" ? name : "");
  if (!content) {
    return NextResponse.json({
      stdout: "",
      stderr: `Template not found: ${name}`,
      exitCode: 1,
      content: "",
    });
  }
  return NextResponse.json({
    stdout: content,
    stderr: "",
    exitCode: 0,
    content,
  });
}
