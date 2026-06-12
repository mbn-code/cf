/**
 * Typed client for the cf workbench HTTP API.
 *
 * Every type here mirrors the JSON contract documented at the top of the
 * matching route file under web/app/api/** (owned by the engine task). The UI
 * consumes these shapes directly — keep them in sync with the route comments.
 */

// ---- Shared ----

export type RunSettings = {
  /** C++ standard without the leading -std=, e.g. "gnu++17". */
  std: string;
  /** Wall-clock limit per execution, milliseconds. */
  timeLimitMs: number;
  /** Extra flags appended to the compile command. */
  compilerFlags: string[];
};

export type CompileStatus = { ok: boolean; stderr: string; ms: number };

export type DiffLine = {
  line: number;
  expected: string;
  actual: string;
  same: boolean;
};

// ---- /api/run ----

export type RunVerdict = "OK" | "CE" | "RE" | "TLE";

export type RunResponse = {
  ok: boolean;
  verdict: RunVerdict;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  timeMs: number;
  truncated: boolean;
  compiler: string | null;
  compile: CompileStatus;
};

// ---- /api/test ----

export type TestVerdict = "AC" | "WA" | "TLE" | "RE" | "CE";

export type TestCaseResult = {
  index: number;
  verdict: TestVerdict;
  input: string;
  expected: string;
  actual: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timeMs: number;
  truncated: boolean;
  diff: DiffLine[];
};

export type TestResponse = {
  ok: boolean;
  compiler: string | null;
  compile: CompileStatus;
  summary: {
    total: number;
    passed: number;
    failed: number;
    verdict: TestVerdict;
  };
  results: TestCaseResult[];
};

// ---- /api/stress ----

export type StressReason =
  | "mismatch"
  | "solution-error"
  | "brute-error"
  | "solution-tle"
  | "brute-tle"
  | "generator-error";

export type StressFailure = {
  iteration: number;
  seed: number;
  reason: StressReason;
  input: string;
  solutionOutput: string;
  bruteOutput: string;
  diff: DiffLine[];
  generatorStderr?: string;
  solutionStderr?: string;
  bruteStderr?: string;
};

export type StressResponse = {
  ok: boolean;
  failed: boolean;
  iterationsRun: number;
  compile: {
    solution: CompileStatus;
    brute: CompileStatus;
    generator: CompileStatus;
  };
  firstFailure?: StressFailure;
  message: string;
};

// ---- /api/problems ----

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

/** Thrown when a request reaches the server but it answers with an error body. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

// ---- Operations ----

export function runCode(
  code: string,
  input: string,
  settings: RunSettings,
): Promise<RunResponse> {
  return postJson<RunResponse>("/api/run", {
    code,
    input,
    timeLimitMs: settings.timeLimitMs,
    std: settings.std,
    compilerFlags: settings.compilerFlags,
  });
}

export function runTests(
  code: string,
  tests: TestCase[],
  settings: RunSettings,
): Promise<TestResponse> {
  return postJson<TestResponse>("/api/test", {
    code,
    tests,
    timeLimitMs: settings.timeLimitMs,
    std: settings.std,
    compilerFlags: settings.compilerFlags,
  });
}

export function runStress(
  args: {
    solution: string;
    brute: string;
    generator: string;
    iterations: number;
  },
  settings: RunSettings,
): Promise<StressResponse> {
  return postJson<StressResponse>("/api/stress", {
    solution: args.solution,
    brute: args.brute,
    generator: args.generator,
    iterations: args.iterations,
    timeLimitMs: settings.timeLimitMs,
    std: settings.std,
  });
}

export async function listProblems(): Promise<ProblemSummary[]> {
  const data = await getJson<{ problems: ProblemSummary[] }>("/api/problems");
  return Array.isArray(data.problems) ? data.problems : [];
}

export async function getProblem(slug: string): Promise<Problem> {
  const data = await getJson<{ problem: Problem }>(
    `/api/problems?name=${encodeURIComponent(slug)}`,
  );
  return data.problem;
}

export async function saveProblem(input: {
  name: string;
  code?: string;
  statement?: string;
  tests?: TestCase[];
}): Promise<Problem> {
  const data = await postJson<{ ok: boolean; problem: Problem }>(
    "/api/problems",
    input,
  );
  return data.problem;
}

export async function renameProblem(
  from: string,
  to: string,
): Promise<Problem> {
  const data = await postJson<{ ok: boolean; problem: Problem }>(
    "/api/problems",
    { op: "rename", from, to },
  );
  return data.problem;
}

export async function deleteProblem(slug: string): Promise<boolean> {
  const res = await fetch(`/api/problems?name=${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    deleted?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      data.error ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return !!data.deleted;
}
