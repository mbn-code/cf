/**
 * web/app/api/_engine/store.ts
 *
 * Persistence helpers for the API routes, using only Node built-ins.
 *
 * Two concerns live here:
 *  1. Problems store — saved problems (source, statement, sample tests, the
 *     custom stdin and the stress sources) persisted as JSON under
 *     <web>/data/problems/<slug>.json. Writes are atomic (temp file + rename)
 *     so a crash mid-write never leaves a half-written record behind.
 *  2. Legacy file helpers — solution.cpp / problem.txt persistence under the
 *     repo `src/<problem>/` tree, kept so the /api/solution, /api/problem-text
 *     and /api/template routes stay self-contained (no dependency on web/lib).
 *     Problem names are validated so a request can never escape the tree.
 */

import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  rm,
  rename,
} from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./cpp";

// ==================== Problems store (web/data) ====================

export type TestCase = { input: string; expected: string };

export type ProblemSettings = {
  std?: string;
  timeLimitMs?: number;
  compilerFlags?: string[];
  checker?: string;
  epsilon?: number;
};

export type Problem = {
  name: string;
  slug: string;
  code: string;
  statement: string;
  tests: TestCase[];
  /** Custom stdin from the Run panel. */
  stdin: string;
  /** Brute-force source from the Stress panel. */
  brute: string;
  /** Generator source from the Stress panel. */
  generator: string;
  /** Per-problem run settings snapshot (optional, merged over defaults). */
  settings: ProblemSettings | null;
  createdAt: number;
  updatedAt: number;
};

export type ProblemSummary = {
  name: string;
  slug: string;
  testCount: number;
  updatedAt: number;
};

/** Directory holding problem JSON files (overridable with CF_DATA_DIR). */
export function problemsDataDir(): string {
  const base = process.env.CF_DATA_DIR
    ? path.resolve(process.env.CF_DATA_DIR)
    : path.join(process.cwd(), "data");
  return path.join(base, "problems");
}

/** Turn an arbitrary problem name into a safe, stable file slug. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "problem";
}

function problemPath(slug: string): string {
  return path.join(problemsDataDir(), `${slug}.json`);
}

async function ensureDataDir(): Promise<void> {
  await mkdir(problemsDataDir(), { recursive: true });
}

/** Write a file atomically: write to a sibling temp file, then rename. */
async function atomicWrite(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data, "utf8");
  try {
    await rename(tmp, file);
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

export function normalizeTests(tests: unknown): TestCase[] {
  if (!Array.isArray(tests)) return [];
  return tests
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      input: typeof t.input === "string" ? t.input : "",
      expected: typeof t.expected === "string" ? t.expected : "",
    }));
}

function normalizeSettings(value: unknown): ProblemSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: ProblemSettings = {};
  if (typeof v.std === "string") out.std = v.std;
  if (typeof v.timeLimitMs === "number" && Number.isFinite(v.timeLimitMs))
    out.timeLimitMs = v.timeLimitMs;
  if (Array.isArray(v.compilerFlags))
    out.compilerFlags = v.compilerFlags.filter(
      (f): f is string => typeof f === "string",
    );
  if (typeof v.checker === "string") out.checker = v.checker;
  if (typeof v.epsilon === "number" && Number.isFinite(v.epsilon))
    out.epsilon = v.epsilon;
  return Object.keys(out).length ? out : null;
}

/** Coerce a raw JSON record (possibly from an older version) into a Problem. */
export function normalizeProblem(
  raw: unknown,
  fallbackSlug: string,
): Problem | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const name =
    typeof p.name === "string" && p.name.trim() ? p.name.trim() : fallbackSlug;
  return {
    name,
    slug: typeof p.slug === "string" && p.slug ? p.slug : slugify(name),
    code: typeof p.code === "string" ? p.code : "",
    statement: typeof p.statement === "string" ? p.statement : "",
    tests: normalizeTests(p.tests),
    stdin: typeof p.stdin === "string" ? p.stdin : "",
    brute: typeof p.brute === "string" ? p.brute : "",
    generator: typeof p.generator === "string" ? p.generator : "",
    settings: normalizeSettings(p.settings),
    createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
  };
}

/** List saved problems (summaries only), newest first. */
export async function listProblems(): Promise<ProblemSummary[]> {
  const full = await listProblemsFull();
  return full.map((p) => ({
    name: p.name,
    slug: p.slug,
    testCount: p.tests.length,
    updatedAt: p.updatedAt,
  }));
}

/** Load every saved problem in full, newest first. */
export async function listProblemsFull(): Promise<Problem[]> {
  try {
    const entries = await readdir(problemsDataDir(), { withFileTypes: true });
    const out: Problem[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const slug = e.name.replace(/\.json$/, "");
      try {
        const raw = await readFile(
          path.join(problemsDataDir(), e.name),
          "utf8",
        );
        const p = normalizeProblem(JSON.parse(raw), slug);
        if (p) out.push(p);
      } catch {
        // skip unreadable/corrupt files
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  } catch {
    return [];
  }
}

/** Load one problem by slug, or null when it does not exist. */
export async function getProblem(slug: string): Promise<Problem | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const raw = await readFile(problemPath(slug), "utf8");
    return normalizeProblem(JSON.parse(raw), slug);
  } catch {
    return null;
  }
}

export type SaveProblemInput = {
  name: string;
  code?: string;
  statement?: string;
  tests?: unknown;
  stdin?: string;
  brute?: string;
  generator?: string;
  settings?: unknown;
  /** Preserve these timestamps (used by import). */
  createdAt?: number;
  updatedAt?: number;
};

/** Create or update a problem keyed by its slug. Returns the stored record. */
export async function saveProblem(input: SaveProblemInput): Promise<Problem> {
  await ensureDataDir();
  const slug = slugify(input.name);
  const now = Date.now();
  const existing = await getProblem(slug);
  const pick = <T>(v: T | undefined, prev: T | undefined, def: T): T =>
    v !== undefined ? v : prev !== undefined ? prev : def;

  const problem: Problem = {
    name: input.name.trim(),
    slug,
    code: pick(input.code, existing?.code, ""),
    statement: pick(input.statement, existing?.statement, ""),
    tests:
      input.tests !== undefined
        ? normalizeTests(input.tests)
        : (existing?.tests ?? []),
    stdin: pick(input.stdin, existing?.stdin, ""),
    brute: pick(input.brute, existing?.brute, ""),
    generator: pick(input.generator, existing?.generator, ""),
    settings:
      input.settings !== undefined
        ? normalizeSettings(input.settings)
        : (existing?.settings ?? null),
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  await atomicWrite(problemPath(slug), `${JSON.stringify(problem, null, 2)}\n`);
  return problem;
}

/** Delete a problem by slug. Returns true when a file was removed. */
export async function deleteProblem(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  try {
    await rm(problemPath(slug));
    return true;
  } catch {
    return false;
  }
}

/** Rename a problem (slug changes). Returns the new record or null if absent. */
export async function renameProblem(
  from: string,
  to: string,
): Promise<Problem | null> {
  const existing = await getProblem(from);
  if (!existing) return null;
  const saved = await saveProblem({
    ...existing,
    name: to,
    createdAt: existing.createdAt,
    updatedAt: undefined,
  });
  if (saved.slug !== from) await deleteProblem(from);
  return saved;
}

/** Duplicate a problem under a new name. Returns null when `from` is absent. */
export async function duplicateProblem(
  from: string,
  to: string,
): Promise<Problem | null> {
  const existing = await getProblem(from);
  if (!existing) return null;
  return saveProblem({
    ...existing,
    name: to,
    createdAt: undefined,
    updatedAt: undefined,
  });
}

export type ImportResult = { imported: number; skipped: number };

/**
 * Import problems from an exported bundle. Existing records are overwritten
 * only when `overwrite` is true; otherwise they are skipped.
 */
export async function importProblems(
  records: unknown,
  overwrite: boolean,
): Promise<ImportResult> {
  if (!Array.isArray(records)) return { imported: 0, skipped: 0 };
  let imported = 0;
  let skipped = 0;
  for (const raw of records) {
    const p = normalizeProblem(raw, "");
    if (!p || !p.name) {
      skipped++;
      continue;
    }
    const slug = slugify(p.name);
    if (!overwrite && (await getProblem(slug))) {
      skipped++;
      continue;
    }
    await saveProblem({
      ...p,
      createdAt: p.createdAt || undefined,
      updatedAt: p.updatedAt || undefined,
    });
    imported++;
  }
  return { imported, skipped };
}

// ==================== Legacy file helpers (repo src tree) ====================

/** Directory holding per-problem source folders (overridable with env). */
export function srcProblemsDir(): string {
  return process.env.CF_PROBLEMS_DIR
    ? path.resolve(process.env.CF_PROBLEMS_DIR)
    : path.join(repoRoot(), "src");
}

/**
 * A problem directory name is a single path segment of safe characters. This
 * is what keeps `../` (or an absolute path) out of the file helpers below.
 */
export function isSafeProblemName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name) &&
    !name.includes("..")
  );
}

function problemFile(problem: string, file: string): string {
  if (!isSafeProblemName(problem)) throw new Error("Invalid problem name");
  return path.join(srcProblemsDir(), problem, file);
}

async function ensureDir(dir: string): Promise<void> {
  if (!(await stat(dir).catch(() => null)))
    await mkdir(dir, { recursive: true });
}

async function readOrEmpty(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function writeIfChanged(file: string, content: string): Promise<void> {
  await ensureDir(path.dirname(file));
  const current = await readFile(file, "utf8").catch(() => null);
  if (current === content) return; // avoid churning mtimes
  await atomicWrite(file, content);
}

export async function getSolution(problem: string): Promise<string> {
  return readOrEmpty(problemFile(problem, "solution.cpp"));
}

export async function saveSolution(
  problem: string,
  code: string,
): Promise<void> {
  await writeIfChanged(problemFile(problem, "solution.cpp"), code);
}

export async function getProblemText(problem: string): Promise<string> {
  return readOrEmpty(problemFile(problem, "problem.txt"));
}

export async function saveProblemText(
  problem: string,
  text: string,
): Promise<void> {
  await writeIfChanged(problemFile(problem, "problem.txt"), text);
}

/** Names of the starter templates shipped under the repo `templates/` dir. */
export async function listTemplates(): Promise<string[]> {
  try {
    const entries = await readdir(path.join(repoRoot(), "templates"));
    return entries
      .filter((f) => f.endsWith(".cpp"))
      .map((f) => f.replace(/\.cpp$/, ""))
      .sort();
  } catch {
    return [];
  }
}

/** Read a named starter template from the repo `templates/` directory. */
export async function readTemplate(name: string): Promise<string> {
  const safe = path.basename(String(name || "").replace(/[^a-zA-Z0-9_-]/g, ""));
  if (!safe) return "";
  return readOrEmpty(path.join(repoRoot(), "templates", `${safe}.cpp`));
}
