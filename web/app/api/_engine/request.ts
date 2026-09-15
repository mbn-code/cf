/**
 * web/app/api/_engine/request.ts
 *
 * Request-parsing helpers shared by every API route so the compile/run
 * options (`std`, `timeLimitMs`, `compilerFlags`, `checker`, `epsilon`) are
 * interpreted identically everywhere.
 */

import { NextResponse } from "next/server";
import { clampTimeLimit, DEFAULT_STD } from "./cpp";
import { validateStd } from "./flags";
import { parseCheckerMode, parseEpsilon, type CheckerMode } from "./compare";

export type Body = Record<string, unknown>;

/** Parse a JSON body, or return a 400 response when it is not an object. */
export async function readJson(
  request: Request,
): Promise<
  { body: Body; error?: undefined } | { body?: undefined; error: NextResponse }
> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        error: NextResponse.json(
          { error: "Request body must be a JSON object" },
          { status: 400 },
        ),
      };
    }
    return { body: parsed as Body };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export type RunOptionsParsed = {
  std: string;
  timeLimitMs: number;
  extraFlags: string[];
  checker: CheckerMode;
  epsilon: number;
};

/** Read the shared compile/run options off a request body. */
export function parseRunOptions(body: Body): RunOptionsParsed {
  return {
    std: validateStd(body.std, DEFAULT_STD),
    timeLimitMs: clampTimeLimit(
      typeof body.timeLimitMs === "number" ? body.timeLimitMs : undefined,
    ),
    extraFlags: Array.isArray(body.compilerFlags)
      ? body.compilerFlags.filter((f): f is string => typeof f === "string")
      : [],
    checker: parseCheckerMode(body.checker),
    epsilon: parseEpsilon(body.epsilon),
  };
}

/** Read a string field, or "" when absent / not a string. */
export function str(body: Body, key: string): string {
  const v = body[key];
  return typeof v === "string" ? v : "";
}
