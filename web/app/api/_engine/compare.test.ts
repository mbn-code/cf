import { describe, expect, it } from "vitest";
import {
  compareOutputs,
  normalize,
  tokenize,
  tokensEqual,
  parseCheckerMode,
  parseEpsilon,
} from "./compare";

describe("normalize", () => {
  it("strips CRLF, trailing spaces and trailing blank lines", () => {
    expect(normalize("1 2 \r\n3\t\r\n\r\n\r\n")).toBe("1 2\n3");
  });
  it("keeps leading whitespace and interior blank lines", () => {
    expect(normalize("  a\n\nb\n")).toBe("  a\n\nb");
  });
});

describe("compareOutputs (lines)", () => {
  it("matches identical output modulo trailing whitespace", () => {
    const r = compareOutputs("5\n", "5   \r\n\n");
    expect(r.match).toBe(true);
    expect(r.diff).toEqual([]);
    expect(r.firstMismatch).toBe(-1);
  });
  it("reports differing lines with 1-based numbers", () => {
    const r = compareOutputs("1\n2\n3\n", "1\n9\n3\n");
    expect(r.match).toBe(false);
    expect(r.firstMismatch).toBe(2);
    expect(r.diff).toEqual([
      { line: 2, expected: "2", actual: "9", same: false },
    ]);
  });
  it("marks missing / extra lines with null", () => {
    const r = compareOutputs("1\n2\n", "1\n");
    expect(r.diff).toEqual([
      { line: 2, expected: "2", actual: null, same: false },
    ]);
  });
  it("caps the diff", () => {
    const exp = Array.from({ length: 500 }, (_, i) => String(i)).join("\n");
    const act = Array.from({ length: 500 }, () => "x").join("\n");
    expect(compareOutputs(exp, act, 10).diff).toHaveLength(10);
    expect(compareOutputs(exp, act, {}, 7).diff).toHaveLength(7);
  });
  it("flags presentation-only mismatches", () => {
    const r = compareOutputs("1 2 3\n", "1\n2\n3\n");
    expect(r.match).toBe(false);
    expect(r.presentationOnly).toBe(true);
  });
  it("does not flag presentation-only when tokens differ", () => {
    const r = compareOutputs("1 2 3\n", "1\n2\n4\n");
    expect(r.presentationOnly).toBeUndefined();
  });
});

describe("compareOutputs (tokens)", () => {
  it("ignores whitespace layout", () => {
    expect(
      compareOutputs("1 2 3\n", "1\n2\n   3\n", { mode: "tokens" }).match,
    ).toBe(true);
  });
  it("still rejects different tokens", () => {
    expect(compareOutputs("1 2 3", "1 2 4", { mode: "tokens" }).match).toBe(
      false,
    );
  });
  it("rejects a different token count", () => {
    expect(compareOutputs("1 2 3", "1 2", { mode: "tokens" }).match).toBe(
      false,
    );
  });
});

describe("compareOutputs (float)", () => {
  it("accepts values within epsilon", () => {
    expect(
      compareOutputs("3.1415926\n", "3.1415927\n", { mode: "float" }).match,
    ).toBe(true);
  });
  it("uses relative tolerance for large magnitudes", () => {
    expect(
      compareOutputs("1000000.0", "1000000.5", { mode: "float", epsilon: 1e-6 })
        .match,
    ).toBe(true);
  });
  it("rejects values outside epsilon", () => {
    expect(
      compareOutputs("1.0", "1.1", { mode: "float", epsilon: 1e-6 }).match,
    ).toBe(false);
  });
  it("compares non-numeric tokens exactly", () => {
    expect(compareOutputs("YES", "yes", { mode: "float" }).match).toBe(false);
    expect(compareOutputs("YES", "YES", { mode: "float" }).match).toBe(true);
  });
});

describe("helpers", () => {
  it("tokenize splits on any whitespace", () => {
    expect(tokenize(" a\tb\n\nc ")).toEqual(["a", "b", "c"]);
  });
  it("tokensEqual handles scientific notation", () => {
    expect(tokensEqual("1e3", "1000", 1e-9)).toBe(true);
    expect(tokensEqual("abc", "1000", 1e-9)).toBe(false);
  });
  it("parseCheckerMode falls back to lines", () => {
    expect(parseCheckerMode("tokens")).toBe("tokens");
    expect(parseCheckerMode("nonsense")).toBe("lines");
    expect(parseCheckerMode(undefined)).toBe("lines");
  });
  it("parseEpsilon rejects garbage", () => {
    expect(parseEpsilon(1e-9)).toBe(1e-9);
    expect(parseEpsilon(-1)).toBe(1e-6);
    expect(parseEpsilon("x")).toBe(1e-6);
    expect(parseEpsilon(5)).toBe(1);
  });
});
