import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseStatement, parseTimeLimit, parseMemoryLimit } from "./statement";

const fixture = readFileSync(
  path.resolve(__dirname, "../../../../tests/fixtures/231A/problem.txt"),
  "utf8",
);

describe("parseStatement", () => {
  it("extracts every sample from a Codeforces statement", () => {
    const r = parseStatement(fixture);
    expect(r.title).toBe("A. Team");
    expect(r.timeLimitMs).toBe(2000);
    expect(r.memoryLimitMb).toBe(256);
    expect(r.tests).toEqual([
      { input: "3\n1 1 0\n1 1 1\n1 0 0\n", expected: "2\n" },
      { input: "2\n1 0 0\n0 1 1\n", expected: "1\n" },
    ]);
  });

  it("stops at the Note section", () => {
    const r = parseStatement(fixture);
    expect(r.tests[1].expected).not.toContain("In the first sample");
  });

  it("accepts the CLI template skeleton with empty samples", () => {
    const r = parseStatement(
      "# Paste the problem statement here\n\nExamples\nInput\n\n\nOutput\n\n\n",
    );
    expect(r.tests).toEqual([]);
  });

  it("handles AtCoder-style 'Sample Input 1' headings", () => {
    const r = parseStatement(
      "Problem\nSample Input 1\n1 2\nSample Output 1\n3\nSample Input 2\n5 5\nSample Output 2\n10\n",
    );
    expect(r.tests).toEqual([
      { input: "1 2\n", expected: "3\n" },
      { input: "5 5\n", expected: "10\n" },
    ]);
  });

  it("handles a statement without an Examples heading", () => {
    const r = parseStatement("Sample Input\n4\nSample Output\n16\n");
    expect(r.tests).toEqual([{ input: "4\n", expected: "16\n" }]);
  });

  it("does not mistake the input-format section for a sample", () => {
    const r = parseStatement(
      "A. X\nInput\nThe first line contains n.\nOutput\nPrint n.\n",
    );
    expect(r.tests).toEqual([]);
  });

  it("ignores 'Copy' button text and CRLF", () => {
    const r = parseStatement(
      "Examples\r\nInput\r\nCopy\r\n1\r\nOutput\r\nCopy\r\n2\r\n",
    );
    expect(r.tests).toEqual([{ input: "1\n", expected: "2\n" }]);
  });

  it("returns no tests for prose", () => {
    expect(parseStatement("just some text").tests).toEqual([]);
  });
});

describe("limits", () => {
  it("parses seconds and milliseconds", () => {
    expect(parseTimeLimit("time limit per test\n1.5 seconds")).toBe(1500);
    expect(parseTimeLimit("time limit: 500 ms")).toBe(500);
    expect(parseTimeLimit("no limit here")).toBeNull();
  });
  it("parses megabytes and gigabytes", () => {
    expect(parseMemoryLimit("memory limit per test\n256 megabytes")).toBe(256);
    expect(parseMemoryLimit("memory limit 1 GB")).toBe(1024);
    expect(parseMemoryLimit("")).toBeNull();
  });
});
