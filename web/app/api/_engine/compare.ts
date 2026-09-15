/**
 * web/app/api/_engine/compare.ts
 *
 * Output comparison helpers shared by /api/test and /api/stress.
 *
 * Three checker modes are supported, mirroring what online judges do:
 *
 *  - `lines`  (default) — trailing whitespace, trailing blank lines and CRLF
 *    differences are ignored; everything else must match line for line.
 *  - `tokens` — outputs are split on any whitespace and compared token by
 *    token. This is the Codeforces "wcmp" checker and is what most problems
 *    with "print the numbers in any order/format" actually use.
 *  - `float`  — like `tokens`, but numeric tokens are compared with an
 *    absolute-or-relative tolerance (`epsilon`, default 1e-6), matching the
 *    classic "answer accepted if |a-b| / max(1,|b|) <= eps" checker.
 *
 * Every mode reports a match flag plus a compact line diff the UI can render.
 */

export type CheckerMode = "lines" | "tokens" | "float";

export const CHECKER_MODES: readonly CheckerMode[] = [
  "lines",
  "tokens",
  "float",
];

export const DEFAULT_EPSILON = 1e-6;

export type CheckerOptions = {
  mode?: CheckerMode;
  /** Tolerance used by the `float` checker. */
  epsilon?: number;
};

/** Coerce request input into a valid checker mode. */
export function parseCheckerMode(value: unknown): CheckerMode {
  return typeof value === "string" &&
    (CHECKER_MODES as string[]).includes(value)
    ? (value as CheckerMode)
    : "lines";
}

/** Coerce request input into a usable epsilon. */
export function parseEpsilon(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return DEFAULT_EPSILON;
  return Math.min(1, value);
}

/**
 * Canonicalise output for tolerant comparison:
 *  - CRLF / CR are converted to LF
 *  - trailing whitespace is stripped from every line
 *  - trailing blank lines are removed
 */
export function normalize(s: string): string {
  const lines = s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Split output into whitespace-separated tokens. */
export function tokenize(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** True when two tokens are equal under the float checker. */
export function tokensEqual(
  expected: string,
  actual: string,
  epsilon: number,
): boolean {
  if (expected === actual) return true;
  if (!NUMERIC.test(expected) || !NUMERIC.test(actual)) return false;
  const e = Number(expected);
  const a = Number(actual);
  if (!Number.isFinite(e) || !Number.isFinite(a)) return false;
  const diff = Math.abs(e - a);
  return diff <= epsilon || diff <= epsilon * Math.max(1, Math.abs(e));
}

export type DiffLine = {
  /** 1-based line number. */
  line: number;
  expected: string | null;
  actual: string | null;
  same: boolean;
};

export type CompareResult = {
  match: boolean;
  /** Only the differing lines (empty when match === true). */
  diff: DiffLine[];
  /** First differing line number, or -1 when outputs match. */
  firstMismatch: number;
  /** The checker mode that produced this verdict. */
  mode: CheckerMode;
  /**
   * Set when the `lines` checker rejected the output but the `tokens` checker
   * would have accepted it — i.e. the answer is right, only the whitespace
   * layout differs. The UI surfaces this as a hint.
   */
  presentationOnly?: boolean;
};

/** Build a per-line diff of two normalised outputs (capped at maxDiff rows). */
function lineDiff(
  expected: string,
  actual: string,
  maxDiff: number,
): { diff: DiffLine[]; firstMismatch: number } {
  const exp = expected.split("\n");
  const act = actual.split("\n");
  const diff: DiffLine[] = [];
  let firstMismatch = -1;
  const max = Math.max(exp.length, act.length);
  for (let i = 0; i < max; i++) {
    const e = i < exp.length ? exp[i] : null;
    const a = i < act.length ? act[i] : null;
    if (e === a) continue;
    if (firstMismatch === -1) firstMismatch = i + 1;
    if (diff.length < maxDiff) {
      diff.push({ line: i + 1, expected: e, actual: a, same: false });
    }
  }
  return { diff, firstMismatch };
}

/** Token-wise comparison; returns true on match. */
function tokensMatch(
  expected: string,
  actual: string,
  epsilon: number | null,
): boolean {
  const e = tokenize(expected);
  const a = tokenize(actual);
  if (e.length !== a.length) return false;
  for (let i = 0; i < e.length; i++) {
    const ok =
      epsilon === null ? e[i] === a[i] : tokensEqual(e[i], a[i], epsilon);
    if (!ok) return false;
  }
  return true;
}

/**
 * Compare two outputs under the chosen checker and return a per-line diff of
 * the lines that differ. The diff is capped so a pathological mismatch can't
 * produce an unbounded payload.
 */
export function compareOutputs(
  expected: string,
  actual: string,
  options: CheckerOptions | number = {},
  maxDiff = 200,
): CompareResult {
  // Backwards-compatible signature: compareOutputs(exp, act, maxDiff).
  const opts: CheckerOptions = typeof options === "number" ? {} : options;
  if (typeof options === "number") maxDiff = options;
  const mode = opts.mode ?? "lines";
  const epsilon = opts.epsilon ?? DEFAULT_EPSILON;

  const normExp = normalize(expected);
  const normAct = normalize(actual);

  let match: boolean;
  switch (mode) {
    case "tokens":
      match = tokensMatch(normExp, normAct, null);
      break;
    case "float":
      match = tokensMatch(normExp, normAct, epsilon);
      break;
    default:
      match = normExp === normAct;
  }

  if (match) return { match: true, diff: [], firstMismatch: -1, mode };

  const { diff, firstMismatch } = lineDiff(normExp, normAct, maxDiff);
  const result: CompareResult = { match: false, diff, firstMismatch, mode };
  if (mode === "lines" && tokensMatch(normExp, normAct, null)) {
    result.presentationOnly = true;
  }
  return result;
}
