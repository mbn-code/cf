/**
 * Typed client for the cf workbench HTTP API.
 *
 * Every type here mirrors the JSON contract documented at the top of the
 * matching route file under web/app/api/**. The UI consumes these shapes
 * directly — keep them in sync with the route comments.
 */

// ---- Shared ----

export type CheckerMode = "lines" | "tokens" | "float";

export type RunSettings = {
  /** C++ standard without the leading -std=, e.g. "gnu++17". */
  std: string;
  /** Wall-clock limit per execution, milliseconds. */
  timeLimitMs: number;
  /** Extra flags appended to the compile command. */
  compilerFlags: string[];
  /** Output comparison mode used by Tests and Stress. */
  checker: CheckerMode;
  /** Tolerance for the float checker. */
  epsilon: number;
};

export type Diagnostic = {
  severity: "error" | "warning" | "note";
  line: number | null;
  column: number | null;
  message: string;
};

export type RejectedFlag = { flag: string; reason: string };

export type CompileStatus = {
  ok: boolean;
  stderr: string;
  ms: number;
  cached?: boolean;
  diagnostics?: Diagnostic[];
  rejectedFlags?: RejectedFlag[];
};

export type DiffLine = {
  line: number;
  expected: string | null;
  actual: string | null;
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

export type TestVerdict = "AC" | "WA" | "TLE" | "RE" | "CE" | "SKIPPED";

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
  presentationOnly?: boolean;
  diff: DiffLine[];
};

export type TestResponse = {
  ok: boolean;
  compiler: string | null;
  compile: CompileStatus;
  checker?: CheckerMode;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped?: number;
    verdict: TestVerdict;
    maxTimeMs?: number;
    totalTimeMs?: number;
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
  elapsedMs?: number;
  deadlineHit?: boolean;
  stats?: { maxSolutionMs: number; maxBruteMs: number; avgSolutionMs: number };
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

export type ProblemSettings = Partial<RunSettings>;

export type Problem = {
  name: string;
  slug: string;
  code: string;
  statement: string;
  tests: TestCase[];
  stdin: string;
  brute: string;
  generator: string;
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

export type ProblemBundle = {
  version: number;
  exportedAt: string;
  problems: Problem[];
};

// ---- /api/samples ----

export type ParsedStatement = {
  title: string | null;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
  tests: TestCase[];
};

// ---- /api/config ----

export type WorkbenchConfig = {
  version: string;
  platform: string;
  compiler: string | null;
  compilerVersion: string | null;
  includeDir: string;
  defaults: {
    std: string;
    timeLimitMs: number;
    maxTimeLimitMs: number;
    checker: CheckerMode;
  };
  limits: {
    maxSourceBytes: number;
    maxInputBytes: number;
    maxOutputBytes: number;
    compileTimeoutMs: number;
  };
  cache: { entries: number };
  startProblem: string | null;
  problemsDir: string | null;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Could not reach the workbench server", 0);
  }
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

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function settingsBody(settings: RunSettings) {
  return {
    timeLimitMs: settings.timeLimitMs,
    std: settings.std,
    compilerFlags: settings.compilerFlags,
    checker: settings.checker,
    epsilon: settings.epsilon,
  };
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
    ...settingsBody(settings),
  });
}

export function runTests(
  code: string,
  tests: TestCase[],
  settings: RunSettings,
  options: { stopOnFirstFailure?: boolean } = {},
): Promise<TestResponse> {
  return postJson<TestResponse>("/api/test", {
    code,
    tests,
    ...settingsBody(settings),
    stopOnFirstFailure: !!options.stopOnFirstFailure,
  });
}

export function runStress(
  args: {
    solution: string;
    brute: string;
    generator: string;
    iterations: number;
    seedBase?: number;
  },
  settings: RunSettings,
): Promise<StressResponse> {
  return postJson<StressResponse>("/api/stress", {
    ...args,
    ...settingsBody(settings),
  });
}

export function parseSamples(statement: string): Promise<ParsedStatement> {
  return postJson<ParsedStatement>("/api/samples", { statement });
}

export function getConfig(): Promise<WorkbenchConfig> {
  return request<WorkbenchConfig>("/api/config");
}

export async function clearServerCache(): Promise<number> {
  const data = await request<{ ok: boolean; cleared: number }>(
    "/api/config?cache=1",
    { method: "DELETE" },
  );
  return data.cleared;
}

export async function listProblems(): Promise<ProblemSummary[]> {
  const data = await request<{ problems: ProblemSummary[] }>("/api/problems");
  return Array.isArray(data.problems) ? data.problems : [];
}

export async function getProblem(slug: string): Promise<Problem> {
  const data = await request<{ problem: Problem }>(
    `/api/problems?name=${encodeURIComponent(slug)}`,
  );
  return data.problem;
}

export async function saveProblem(input: {
  name: string;
  code?: string;
  statement?: string;
  tests?: TestCase[];
  stdin?: string;
  brute?: string;
  generator?: string;
  settings?: ProblemSettings | null;
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

export async function duplicateProblem(
  from: string,
  to: string,
): Promise<Problem> {
  const data = await postJson<{ ok: boolean; problem: Problem }>(
    "/api/problems",
    { op: "duplicate", from, to },
  );
  return data.problem;
}

export async function deleteProblem(slug: string): Promise<boolean> {
  const data = await request<{ ok?: boolean; deleted?: boolean }>(
    `/api/problems?name=${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
  return !!data.deleted;
}

export function exportProblems(): Promise<ProblemBundle> {
  return request<ProblemBundle>("/api/problems?export=1");
}

export async function importProblems(
  problems: unknown,
  overwrite: boolean,
): Promise<{ imported: number; skipped: number }> {
  const data = await postJson<{
    ok: boolean;
    imported: number;
    skipped: number;
  }>("/api/problems", { op: "import", problems, overwrite });
  return { imported: data.imported, skipped: data.skipped };
}
