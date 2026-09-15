import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  saveProblem,
  getProblem,
  listProblems,
  listProblemsFull,
  renameProblem,
  duplicateProblem,
  deleteProblem,
  importProblems,
  slugify,
  isSafeProblemName,
  normalizeProblem,
  problemsDataDir,
} from "./store";

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "cf-store-test-"));
  process.env.CF_DATA_DIR = dataDir;
});

afterAll(async () => {
  delete process.env.CF_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

describe("slugify", () => {
  it("normalises names", () => {
    expect(slugify("1620C - Bad Sums!")).toBe("1620c-bad-sums");
    expect(slugify("   ")).toBe("problem");
    expect(slugify("x".repeat(200))).toHaveLength(80);
  });
});

describe("isSafeProblemName", () => {
  it("accepts plain segments and rejects traversal", () => {
    expect(isSafeProblemName("1000A")).toBe(true);
    expect(isSafeProblemName("bear-and-big_brother.v2")).toBe(true);
    expect(isSafeProblemName("../etc")).toBe(false);
    expect(isSafeProblemName("a/b")).toBe(false);
    expect(isSafeProblemName("a\\b")).toBe(false);
    expect(isSafeProblemName(".hidden")).toBe(false);
    expect(isSafeProblemName("")).toBe(false);
    expect(isSafeProblemName(null)).toBe(false);
  });
});

describe("problems store", () => {
  it("uses the CF_DATA_DIR override", () => {
    expect(problemsDataDir()).toBe(path.join(dataDir, "problems"));
  });

  it("saves and loads a full workspace", async () => {
    const saved = await saveProblem({
      name: "Test A",
      code: "int main(){}",
      tests: [{ input: "1\n", expected: "2\n" }, { bogus: true }],
      stdin: "1\n",
      brute: "// brute",
      generator: "// gen",
      settings: { std: "gnu++20", timeLimitMs: 1000, junk: 1 },
    });
    expect(saved.slug).toBe("test-a");
    expect(saved.tests).toEqual([
      { input: "1\n", expected: "2\n" },
      { input: "", expected: "" },
    ]);
    expect(saved.settings).toEqual({ std: "gnu++20", timeLimitMs: 1000 });

    const loaded = await getProblem("test-a");
    expect(loaded).toEqual(saved);
  });

  it("merges partial updates over the existing record", async () => {
    const updated = await saveProblem({ name: "Test A", stdin: "9\n" });
    expect(updated.code).toBe("int main(){}");
    expect(updated.stdin).toBe("9\n");
    expect(updated.brute).toBe("// brute");
    expect(updated.createdAt).toBeLessThanOrEqual(updated.updatedAt);
  });

  it("writes atomically (no temp files left behind)", async () => {
    const files = await readdir(problemsDataDir());
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("lists summaries newest first", async () => {
    await saveProblem({ name: "Test B", code: "b" });
    const list = await listProblems();
    expect(list.map((p) => p.slug)).toEqual(["test-b", "test-a"]);
    expect(list[1].testCount).toBe(2);
  });

  it("renames, duplicates and deletes", async () => {
    const renamed = await renameProblem("test-b", "Test C");
    expect(renamed?.slug).toBe("test-c");
    expect(await getProblem("test-b")).toBeNull();

    const dup = await duplicateProblem("test-c", "Test D");
    expect(dup?.code).toBe("b");
    expect((await listProblems()).map((p) => p.slug).sort()).toEqual([
      "test-a",
      "test-c",
      "test-d",
    ]);

    expect(await deleteProblem("test-d")).toBe(true);
    expect(await deleteProblem("test-d")).toBe(false);
    expect(await deleteProblem("../evil")).toBe(false);
  });

  it("imports a bundle and respects overwrite", async () => {
    const bundle = (await listProblemsFull()).map((p) => ({
      ...p,
      code: "imported",
    }));
    const skipped = await importProblems(bundle, false);
    expect(skipped).toEqual({ imported: 0, skipped: bundle.length });
    expect((await getProblem("test-a"))?.code).toBe("int main(){}");

    const over = await importProblems([...bundle, null, { name: "" }], true);
    expect(over).toEqual({ imported: bundle.length, skipped: 2 });
    expect((await getProblem("test-a"))?.code).toBe("imported");
  });

  it("tolerates records written by older versions", () => {
    const p = normalizeProblem(
      { name: "Old", code: "c", tests: "nope" },
      "old",
    );
    expect(p).toMatchObject({
      name: "Old",
      slug: "old",
      code: "c",
      tests: [],
      stdin: "",
      settings: null,
    });
    expect(normalizeProblem("garbage", "x")).toBeNull();
  });
});
