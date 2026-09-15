/**
 * /api/template — starter templates shipped under the repo `templates/` dir.
 *
 * GET  /api/template            → { templates: string[] }   // e.g. ["dp","graph","math"]
 * POST /api/template { name }   → { stdout, stderr, exitCode, content }
 *           `stdout` and `content` both hold the template text (stdout kept for
 *           backward compatibility). On a miss: exitCode 1 and an error stderr.
 */

import { NextResponse } from "next/server";
import { readTemplate, listTemplates } from "../_engine/store";
import { readJson, str } from "../_engine/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(request: Request) {
  const { body, error } = await readJson(request);
  if (error) return error;
  const name = str(body, "name");
  const content = await readTemplate(name);
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
