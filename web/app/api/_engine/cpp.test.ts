import { afterAll, describe, expect, it } from "vitest";
import {
  compile,
  runBinary,
  cleanup,
  detectCompiler,
  compilerVersion,
  clearCompileCache,
  compileCacheSize,
  runVerdict,
  clampTimeLimit,
  includeDir,
} from "./cpp";

/**
 * These tests exercise the real toolchain. They are skipped (not failed) on a
 * machine without a C++ compiler so the rest of the unit suite still runs.
 */
const hasCompiler = detectCompiler() !== null;
const maybe = hasCompiler ? describe : describe.skip;

const AB = `#include <bits/stdc++.h>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<"\\n"; }
`;

afterAll(async () => {
  await clearCompileCache();
});

describe("clampTimeLimit", () => {
  it("clamps into [100, 60000] and defaults", () => {
    expect(clampTimeLimit(undefined)).toBe(5000);
    expect(clampTimeLimit(1)).toBe(100);
    expect(clampTimeLimit(1e9)).toBe(60000);
    expect(clampTimeLimit(NaN)).toBe(5000);
    expect(clampTimeLimit(1234.9)).toBe(1234);
  });
});

maybe("compile + run", () => {
  it("reports the compiler version", () => {
    expect(compilerVersion()).toBeTruthy();
    expect(includeDir()).toMatch(/include$/);
  });

  it("compiles and runs A+B, then serves the second compile from cache", async () => {
    await clearCompileCache();
    const first = await compile(AB, { std: "gnu++17" });
    expect(first.ok).toBe(true);
    expect(first.cached).toBe(false);
    expect(first.binPath).toBeTruthy();
    expect(compileCacheSize()).toBe(1);

    const run = await runBinary(first.binPath!, { input: "2 3\n" });
    expect(run.stdout.trim()).toBe("5");
    expect(runVerdict(run)).toBe("OK");
    expect(run.timeMs).toBeGreaterThan(0);

    const second = await compile(AB, { std: "gnu++17" });
    expect(second.cached).toBe(true);
    expect(second.ms).toBe(0);
    expect(second.binPath).toBe(first.binPath);
    expect(compileCacheSize()).toBe(1);

    // A different standard is a different cache entry.
    const third = await compile(AB, { std: "gnu++20" });
    expect(third.cached).toBe(false);
    expect(compileCacheSize()).toBe(2);
  });

  it("coalesces identical concurrent compiles", async () => {
    await clearCompileCache();
    const src = `${AB}// concurrent\n`;
    const [a, b] = await Promise.all([compile(src), compile(src)]);
    expect(a.ok && b.ok).toBe(true);
    expect(a.binPath).toBe(b.binPath);
    expect(compileCacheSize()).toBe(1);
  });

  it("returns structured diagnostics on a compile error", async () => {
    const r = await compile("int main() { return x; }\n");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("compile-error");
    expect(r.stderr).toContain("main.cpp:1");
    expect(
      r.diagnostics.some((d) => d.severity === "error" && d.line === 1),
    ).toBe(true);
    expect(r.workDir).toBeTruthy();
    await cleanup(r.workDir);
  });

  it("drops disallowed flags and reports them", async () => {
    const r = await compile(AB, { extraFlags: ["-Wall", "-o", "/tmp/evil"] });
    expect(r.ok).toBe(true);
    expect(r.rejectedFlags.map((f) => f.flag)).toEqual(["-o", "/tmp/evil"]);
  });

  it("classifies a timeout as TLE", async () => {
    // A side-effect-free infinite loop is UB in C++ and gcc -O2 deletes it
    // (the ubuntu runner returned immediately); the volatile write keeps it.
    const r = await compile(
      "int main(){ volatile unsigned long long n = 0; for(;;){ ++n; } }\n",
    );
    expect(r.ok).toBe(true);
    const run = await runBinary(r.binPath!, { timeLimitMs: 300 });
    expect(run.timedOut).toBe(true);
    expect(runVerdict(run)).toBe("TLE");
    expect(run.timeMs).toBeGreaterThanOrEqual(250);
  });

  it("classifies a non-zero exit as RE", async () => {
    const r = await compile("int main(){ return 3; }\n");
    const run = await runBinary(r.binPath!);
    expect(run.exitCode).toBe(3);
    expect(runVerdict(run)).toBe("RE");
  });

  it("truncates runaway output and reports it", async () => {
    const r = await compile(
      '#include <cstdio>\nint main(){ for(;;) puts("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); }\n',
    );
    const run = await runBinary(r.binPath!, {
      timeLimitMs: 5000,
      maxOutputBytes: 64 * 1024,
    });
    expect(run.truncated).toBe(true);
    expect(run.stdout.length).toBeLessThanOrEqual(64 * 1024);
  });

  it("rejects oversized sources without invoking the compiler", async () => {
    const r = await compile("x".repeat(2 * 1024 * 1024));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("source-too-large");
  });

  it("surfaces a spawn error for a missing binary", async () => {
    const run = await runBinary("/definitely/not/here/prog");
    expect(run.spawnError).toBeTruthy();
    expect(runVerdict(run)).toBe("RE");
  });
});
