/**
 * web/app/api/_engine/statement.ts
 *
 * Parse a problem statement pasted from Codeforces (or a similar judge) into
 * sample test cases plus the limits the statement declares. This is the same
 * heuristic the `cf` CLI applies to `problem.txt`, ported to TypeScript so the
 * web workbench can turn a pasted statement into test cases in one click.
 *
 * Recognised layout (headings are case-insensitive, a trailing colon and the
 * "Copy" button text Codeforces adds are ignored):
 *
 *   A. Title
 *   time limit per test
 *   2 seconds
 *   memory limit per test
 *   256 megabytes
 *   ...
 *   Examples            (or "Example", "Sample 1", "Examples:")
 *   Input               (or "Sample Input", "Sample Input 1", "inputCopy")
 *   <lines>
 *   Output              (or "Sample Output", "outputCopy")
 *   <lines>
 *   Input ... Output ...  (repeated)
 *   Note                (ends the examples section)
 */

export type ParsedStatement = {
  /** First non-empty line of the statement, typically "A. Title". */
  title: string | null;
  /** Time limit in milliseconds when the statement declares one. */
  timeLimitMs: number | null;
  /** Memory limit in megabytes when the statement declares one. */
  memoryLimitMb: number | null;
  /** Extracted samples, each with a trailing newline. */
  tests: { input: string; expected: string }[];
};

function normHead(line: string): string {
  return line
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .trim();
}

function isExamplesHead(line: string): boolean {
  const h = normHead(line);
  return (
    h === "examples" ||
    h === "example" ||
    /^example\s*\d+$/.test(h) ||
    /^samples?$/.test(h) ||
    /^sample\s*\d+$/.test(h) ||
    /^sample (tests?|cases?)$/.test(h)
  );
}

function isInputHead(line: string): boolean {
  const h = normHead(line).replace(/copy$/, "").trim();
  return (
    h === "input" ||
    h === "sample input" ||
    /^sample input\s*\d+$/.test(h) ||
    /^input\s*\d+$/.test(h) ||
    h === "standard input"
  );
}

function isOutputHead(line: string): boolean {
  const h = normHead(line).replace(/copy$/, "").trim();
  return (
    h === "output" ||
    h === "sample output" ||
    /^sample output\s*\d+$/.test(h) ||
    /^output\s*\d+$/.test(h) ||
    h === "standard output"
  );
}

function isStopHead(line: string): boolean {
  const h = normHead(line);
  return (
    h === "note" ||
    h === "notes" ||
    h === "explanation" ||
    h === "constraints" ||
    h === "scoring" ||
    h === "interaction"
  );
}

function trimBlock(lines: string[]): string {
  const copy = [...lines];
  while (copy.length && copy[0].trim() === "") copy.shift();
  while (copy.length && copy[copy.length - 1].trim() === "") copy.pop();
  if (copy.length === 0) return "";
  return `${copy.map((l) => l.replace(/[ \t]+$/, "")).join("\n")}\n`;
}

const TIME_RE =
  /time limit(?: per test)?[^\d]*(\d+(?:\.\d+)?)\s*(seconds?|s\b|ms|milliseconds?)/i;
const MEM_RE =
  /memory limit(?: per test)?[^\d]*(\d+(?:\.\d+)?)\s*(megabytes?|mb|gigabytes?|gb|kilobytes?|kb)/i;

/** Parse "2 seconds" / "1.5 s" / "500 ms" style limits into milliseconds. */
export function parseTimeLimit(text: string): number | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2].toLowerCase();
  return unit.startsWith("ms") || unit.startsWith("milli")
    ? Math.round(n)
    : Math.round(n * 1000);
}

/** Parse "256 megabytes" / "1 GB" style limits into megabytes. */
export function parseMemoryLimit(text: string): number | null {
  const m = MEM_RE.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2].toLowerCase();
  if (unit.startsWith("g")) return Math.round(n * 1024);
  if (unit.startsWith("k")) return Math.round(n / 1024);
  return Math.round(n);
}

/**
 * Extract samples and limits from a statement. Never throws; a statement
 * without an examples section yields `tests: []`.
 */
export function parseStatement(text: string): ParsedStatement {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  const firstLine = lines.find((l) => l.trim() !== "") ?? null;
  const title = firstLine ? firstLine.trim().slice(0, 200) : null;

  // Limits appear in the header; only scan the first few hundred characters
  // so a "time limit" phrase inside a note is not misread.
  const head = lines.slice(0, 12).join("\n");
  const timeLimitMs = parseTimeLimit(head);
  const memoryLimitMb = parseMemoryLimit(head);

  const tests: { input: string; expected: string }[] = [];
  let inExamples = false;
  let block: "input" | "output" | null = null;
  let curInput: string[] = [];
  let curOutput: string[] = [];
  let haveInput = false;

  const flush = () => {
    if (haveInput) {
      tests.push({
        input: trimBlock(curInput),
        expected: trimBlock(curOutput),
      });
    }
    curInput = [];
    curOutput = [];
    haveInput = false;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!inExamples) {
      if (isExamplesHead(line)) inExamples = true;
      // AtCoder-style statements have no "Examples" heading; their samples
      // start with an unambiguous "Sample Input N". A bare "Input" is the
      // input-format section of the statement and must not count.
      else if (/^sample input/.test(normHead(line))) {
        inExamples = true;
        block = "input";
        haveInput = true;
      }
      continue;
    }

    if (isInputHead(line)) {
      flush();
      block = "input";
      haveInput = true;
      continue;
    }
    if (isOutputHead(line)) {
      block = "output";
      continue;
    }
    if (isStopHead(line) || (block === "output" && isExamplesHead(line))) {
      flush();
      break;
    }
    if (block === null) continue;
    if (normHead(line) === "copy") continue;
    if (block === "input") curInput.push(line);
    else curOutput.push(line);
  }
  flush();

  return {
    title,
    timeLimitMs,
    memoryLimitMb,
    tests: tests.filter((t) => t.input !== "" || t.expected !== ""),
  };
}
