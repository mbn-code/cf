import { describe, expect, it } from "vitest";
import { validateFlags, validateStd, tokenizeFlags } from "./flags";

describe("validateFlags", () => {
  it("accepts the everyday competitive-programming flags", () => {
    const { accepted, rejected } = validateFlags([
      "-Wall",
      "-Wextra",
      "-O3",
      "-DLOCAL",
      "-DDEBUG=1",
      "-g",
      "-fsanitize=address,undefined",
      "-march=native",
      "-std=gnu++20",
      "-pedantic",
    ]);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(10);
  });

  it("rejects flags that write files or load code", () => {
    const { accepted, rejected } = validateFlags([
      "-o",
      "/tmp/x",
      "-include",
      "/etc/passwd",
      "@resp.txt",
      "-fplugin=evil.so",
      "-Wl,-rpath,/x",
      "-I/etc",
      "-lfoo",
      "-fprofile-generate",
    ]);
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.flag)).toContain("-fplugin=evil.so");
    expect(rejected.map((r) => r.flag)).toContain("-Wl,-rpath,/x");
    expect(rejected.map((r) => r.flag)).toContain("-o");
  });

  it("rejects shell metacharacters and bogus standards", () => {
    const { accepted, rejected } = validateFlags([
      "-DX=$(rm -rf /)",
      "-std=c++99",
      "-Wall;ls",
    ]);
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(3);
  });

  it("dedupes and accepts a raw string", () => {
    expect(validateFlags("-Wall -Wall -O2").accepted).toEqual(["-Wall", "-O2"]);
  });

  it("treats non-list input as empty", () => {
    expect(validateFlags(42)).toEqual({ accepted: [], rejected: [] });
  });
});

describe("validateStd", () => {
  it("accepts known standards and falls back otherwise", () => {
    expect(validateStd("gnu++17", "x")).toBe("gnu++17");
    expect(validateStd("c++23", "x")).toBe("c++23");
    expect(validateStd("c++98", "gnu++17")).toBe("gnu++17");
    expect(validateStd("gnu++17; rm", "gnu++17")).toBe("gnu++17");
    expect(validateStd(undefined, "gnu++17")).toBe("gnu++17");
  });
});

describe("tokenizeFlags", () => {
  it("splits on whitespace", () => {
    expect(tokenizeFlags("  -Wall\t-O2\n")).toEqual(["-Wall", "-O2"]);
  });
});
