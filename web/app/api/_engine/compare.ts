/**
 * web/app/api/_engine/compare.ts
 *
 * Output comparison helpers shared by /api/test and /api/stress.
 *
 * Competitive-programming judges accept output that differs only in trailing
 * whitespace, trailing blank lines, and line-ending style. `normalize` encodes
 * that tolerance; `compareOutputs` reports a match plus a compact line diff that
 * the UI can render.
 */

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
};

/**
 * Compare two outputs with trailing-whitespace tolerance and return a per-line
 * diff of the lines that differ. The diff is capped so a pathological mismatch
 * can't produce an unbounded payload.
 */
export function compareOutputs(
  expected: string,
  actual: string,
  maxDiff = 200,
): CompareResult {
  const exp = normalize(expected).split("\n");
  const act = normalize(actual).split("\n");
  const match = normalize(expected) === normalize(actual);
  if (match) return { match: true, diff: [], firstMismatch: -1 };

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
  return { match: false, diff, firstMismatch };
}
