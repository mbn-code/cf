import { describe, expect, it } from "vitest";
import { parseDiagnostics, summarizeDiagnostics } from "./diagnostics";

const GCC = `main.cpp: In function 'int main()':
main.cpp:5:9: error: 'x' was not declared in this scope
    5 |     int y = x;
      |         ^
main.cpp:7:5: warning: unused variable 'y' [-Wunused-variable]
/usr/include/c++/13/bits/stl_vector.h:100:3: note: declared here
`;

const CLANG = `main.cpp:3:12: error: use of undeclared identifier 'foo'
    return foo;
           ^
1 error generated.
`;

describe("parseDiagnostics", () => {
  it("parses gcc output with line and column", () => {
    const d = parseDiagnostics(GCC);
    expect(d).toHaveLength(3);
    expect(d[0]).toEqual({
      severity: "error",
      line: 5,
      column: 9,
      message: "'x' was not declared in this scope",
    });
    expect(d[1].severity).toBe("warning");
    expect(d[1].line).toBe(7);
  });

  it("drops line numbers for diagnostics in other files", () => {
    const d = parseDiagnostics(GCC);
    expect(d[2]).toEqual({
      severity: "note",
      line: null,
      column: null,
      message: "declared here",
    });
  });

  it("parses clang output", () => {
    const d = parseDiagnostics(CLANG);
    expect(d).toHaveLength(1);
    expect(d[0].line).toBe(3);
    expect(d[0].column).toBe(12);
  });

  it("handles fatal errors and windows paths", () => {
    const d = parseDiagnostics(
      "C:\\tmp\\cf-x\\main.cpp:1:10: fatal error: foo.h: No such file or directory",
    );
    expect(d[0].severity).toBe("error");
    expect(d[0].line).toBe(1);
  });

  it("returns nothing for empty stderr", () => {
    expect(parseDiagnostics("")).toEqual([]);
  });

  it("summarizes counts", () => {
    expect(summarizeDiagnostics(parseDiagnostics(GCC))).toEqual({
      errors: 1,
      warnings: 1,
    });
  });
});
