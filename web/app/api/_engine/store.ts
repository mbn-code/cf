/**
 * web/app/api/_engine/store.ts
 *
 * Persistence helpers for the API routes, using only Node built-ins.
 *
 * Two concerns live here:
 *  1. Problems store — saved problems and their test cases, persisted as JSON
 *     under <web>/data/problems/<slug>.json (the canonical store the workbench
 *     reads/writes via /api/problems).
 *  2. Legacy file helpers — solution.cpp / problem.txt persistence under the
 *     repo `src/<problem>/` tree, kept so the /api/solution, /api/problem-text
 *     and /api/template routes stay self-contained (no dependency on web/lib).
 */

import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./cpp";

// ==================== Problems store (web/data) ====================

export type TestCase = { input: string; expected: string };

export type Problem = {
  name: string;
  slug: string;
  code: string;
  statement: string;
  tests: TestCase[];
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

function normalizeTests(tests: unknown): TestCase[] {
  if (!Array.isArray(tests)) return [];
  return tests
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      input: typeof t.input === "string" ? t.input : "",
      expected: typeof t.expected === "string" ? t.expected : "",
    }));
}

/** List saved problems (summaries only), newest first. */
export async function listProblems(): Promise<ProblemSummary[]> {
  try {
    const entries = await readdir(problemsDataDir(), { withFileTypes: true });
    const summaries: ProblemSummary[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      try {
        const raw = await readFile(
          path.join(problemsDataDir(), e.name),
          "utf8",
        );
        const p = JSON.parse(raw) as Problem;
        summaries.push({
          name:
            typeof p.name === "string" ? p.name : e.name.replace(/\.json$/, ""),
          slug:
            typeof p.slug === "string" ? p.slug : e.name.replace(/\.json$/, ""),
          testCount: Array.isArray(p.tests) ? p.tests.length : 0,
          updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
        });
      } catch {
        // skip unreadable/corrupt files
      }
    }
    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    return summaries;
  } catch {
    return [];
  }
}

/** Load one problem by slug, or null when it does not exist. */
export async function getProblem(slug: string): Promise<Problem | null> {
  try {
    const raw = await readFile(problemPath(slug), "utf8");
    return JSON.parse(raw) as Problem;
  } catch {
    return null;
  }
}

/** Create or update a problem keyed by its slug. Returns the stored record. */
export async function saveProblem(input: {
  name: string;
  code?: string;
  statement?: string;
  tests?: unknown;
}): Promise<Problem> {
  await ensureDataDir();
  const slug = slugify(input.name);
  const now = Date.now();
  const existing = await getProblem(slug);
  const problem: Problem = {
    name: input.name,
    slug,
    code: typeof input.code === "string" ? input.code : (existing?.code ?? ""),
    statement:
      typeof input.statement === "string"
        ? input.statement
        : (existing?.statement ?? ""),
    tests:
      input.tests !== undefined
        ? normalizeTests(input.tests)
        : (existing?.tests ?? []),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeFile(
    problemPath(slug),
    `${JSON.stringify(problem, null, 2)}\n`,
    "utf8",
  );
  return problem;
}

/** Delete a problem by slug. Returns true when a file was removed. */
export async function deleteProblem(slug: string): Promise<boolean> {
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
    name: to,
    code: existing.code,
    statement: existing.statement,
    tests: existing.tests,
  });
  if (saved.slug !== from) await deleteProblem(from);
  return saved;
}

// ==================== Legacy file helpers (repo src tree) ====================

/** Directory holding per-problem source folders (overridable with env). */
export function srcProblemsDir(): string {
  return process.env.CF_PROBLEMS_DIR
    ? path.resolve(process.env.CF_PROBLEMS_DIR)
    : path.join(repoRoot(), "src");
}

async function ensureDir(dir: string): Promise<void> {
  if (!(await stat(dir).catch(() => null)))
    await mkdir(dir, { recursive: true });
}

export async function getSolution(problem: string): Promise<string> {
  try {
    return await readFile(
      path.join(srcProblemsDir(), problem, "solution.cpp"),
      "utf8",
    );
  } catch {
    return "";
  }
}

export async function saveSolution(
  problem: string,
  code: string,
): Promise<void> {
  const dir = path.join(srcProblemsDir(), problem);
  await ensureDir(dir);
  const file = path.join(dir, "solution.cpp");
  const current = await readFile(file, "utf8").catch(() => null);
  if (current === code) return; // avoid churning mtimes
  await writeFile(file, code, "utf8");
}

export async function getProblemText(problem: string): Promise<string> {
  try {
    return await readFile(
      path.join(srcProblemsDir(), problem, "problem.txt"),
      "utf8",
    );
  } catch {
    return "";
  }
}

export async function saveProblemText(
  problem: string,
  text: string,
): Promise<void> {
  const dir = path.join(srcProblemsDir(), problem);
  await ensureDir(dir);
  const file = path.join(dir, "problem.txt");
  const current = await readFile(file, "utf8").catch(() => null);
  if (current === text) return;
  await writeFile(file, text, "utf8");
}

/** Read a named starter template from the repo `templates/` directory. */
export async function readTemplate(name: string): Promise<string> {
  const safe = path.basename(String(name || "").replace(/[^a-zA-Z0-9_-]/g, ""));
  if (!safe) return "";
  try {
    return await readFile(
      path.join(repoRoot(), "templates", `${safe}.cpp`),
      "utf8",
    );
  } catch {
    return "";
  }
}
