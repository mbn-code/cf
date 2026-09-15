"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import {
  Play,
  Loader2,
  Terminal as TerminalIcon,
  FlaskConical,
  Swords,
  Settings as SettingsIcon,
  PanelLeft,
  FileCode,
  Minus,
  Plus,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  runCode,
  runTests,
  listProblems,
  getProblem,
  saveProblem,
  renameProblem,
  duplicateProblem,
  deleteProblem,
  exportProblems,
  importProblems,
  parseSamples,
  getConfig,
  type RunResponse,
  type TestResponse,
  type TestCaseResult,
  type RunSettings,
  type ProblemSummary,
  type Diagnostic,
  type WorkbenchConfig,
  type ParsedStatement,
} from "@/lib/api";
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_TESTS,
  DEFAULT_STDIN,
  DEFAULT_LAYOUT,
  MIN_PANEL_FRACTION,
  MAX_PANEL_FRACTION,
  loadJSON,
  loadString,
  saveJSON,
  saveString,
  normalizeSettings,
  normalizeLayout,
  clampTimeLimit,
  toTestCases,
  type SampleTest,
} from "@/lib/storage";
import {
  DEFAULT_CODE,
  TEMPLATES,
  BRUTE_TEMPLATE,
  GENERATOR_TEMPLATE,
} from "@/lib/templates";

import {
  CodeEditor,
  type LineMarkers,
  type CursorPosition,
} from "@/components/CodeEditor";
import { RunPanel } from "@/components/RunPanel";
import { TestsPanel } from "@/components/TestsPanel";
import { StressPanel } from "@/components/StressPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ProblemsSidebar } from "@/components/ProblemsSidebar";
import { Resizer } from "@/components/Resizer";

type PanelTab = "run" | "tests" | "stress" | "settings";

const PANEL_TABS: {
  id: PanelTab;
  label: string;
  icon: ElementType;
  key: string;
}[] = [
  { id: "run", label: "Run", icon: TerminalIcon, key: "1" },
  { id: "tests", label: "Tests", icon: FlaskConical, key: "2" },
  { id: "stress", label: "Stress", icon: Swords, key: "3" },
  { id: "settings", label: "Settings", icon: SettingsIcon, key: "4" },
];

type StressState = { brute: string; generator: string; iterations: number };

const DEFAULT_STRESS: StressState = {
  brute: BRUTE_TEMPLATE,
  generator: GENERATOR_TEMPLATE,
  iterations: 100,
};

function withIds(cases: { input: string; expected: string }[], start: number) {
  return cases.map((c, i) => ({
    id: start + i,
    input: c.input,
    expected: c.expected,
  }));
}

function isPanelTab(v: string): v is PanelTab {
  return PANEL_TABS.some((t) => t.id === v);
}

/** Everything that is persisted with a problem, for dirty tracking. */
function snapshot(
  code: string,
  tests: SampleTest[],
  stdin: string,
  stress: StressState,
  settings: RunSettings,
): string {
  return JSON.stringify({
    code,
    tests: toTestCases(tests),
    stdin,
    brute: stress.brute,
    generator: stress.generator,
    settings,
  });
}

function markersFrom(diags: Diagnostic[] | undefined): LineMarkers {
  const m: LineMarkers = {};
  for (const d of diags ?? []) {
    if (d.line === null || d.severity === "note") continue;
    if (d.severity === "error" || !m[d.line]) m[d.line] = d.severity;
  }
  return m;
}

export default function Workbench() {
  const [mounted, setMounted] = useState(false);

  // Editor + tooling state (hydrated from localStorage after mount).
  const [code, setCode] = useState(DEFAULT_CODE);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [settings, setSettings] = useState<RunSettings>(DEFAULT_SETTINGS);
  const [tests, setTests] = useState<SampleTest[]>(() =>
    withIds(DEFAULT_TESTS, 1),
  );
  const [stress, setStress] = useState<StressState>(DEFAULT_STRESS);
  const [stdin, setStdin] = useState(DEFAULT_STDIN);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  // Execution results.
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [stopOnFirstFailure, setStopOnFirstFailure] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  // Problems library.
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [problemsBusy, setProblemsBusy] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [config, setConfig] = useState<WorkbenchConfig | null>(null);

  // Layout.
  const [activeTab, setActiveTab] = useState<PanelTab>("run");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [gotoLine, setGotoLine] = useState<{
    line: number;
    nonce: number;
  } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const idRef = useRef(1);
  const nextId = useCallback(() => {
    const v = idRef.current;
    idRef.current += 1;
    return v;
  }, []);

  const refreshProblems = useCallback(async () => {
    setProblemsBusy(true);
    try {
      setProblems(await listProblems());
    } catch {
      // listing is best-effort; an empty library is a valid state.
    } finally {
      setProblemsBusy(false);
    }
  }, []);

  // ---- Hydration from localStorage (runs once on mount) ----
  useEffect(() => {
    setCode(loadString(STORAGE_KEYS.code, DEFAULT_CODE));
    setStdin(loadString(STORAGE_KEYS.stdin, DEFAULT_STDIN));
    const storedFont = loadJSON<number>(
      STORAGE_KEYS.fontSize,
      DEFAULT_FONT_SIZE,
    );
    setFontSize(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, storedFont)));
    setSettings(
      normalizeSettings(loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS)),
    );
    setLayout(normalizeLayout(loadJSON(STORAGE_KEYS.layout, DEFAULT_LAYOUT)));
    const tab = loadString(STORAGE_KEYS.activeTab, "run");
    if (isPanelTab(tab)) setActiveTab(tab);

    const storedTests = loadJSON<SampleTest[]>(STORAGE_KEYS.tests, []);
    const hydrated =
      Array.isArray(storedTests) && storedTests.length > 0
        ? storedTests
            .filter((t) => t && typeof t === "object")
            .map((t) => ({
              id: typeof t.id === "number" ? t.id : nextId(),
              input: typeof t.input === "string" ? t.input : "",
              expected: typeof t.expected === "string" ? t.expected : "",
            }))
        : withIds(DEFAULT_TESTS, 1);
    idRef.current = hydrated.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    setTests(hydrated);

    setStress({ ...DEFAULT_STRESS, ...loadJSON(STORAGE_KEYS.stress, {}) });
    setActiveSlug(loadString(STORAGE_KEYS.activeProblem, "") || null);

    setMounted(true);
    refreshProblems();
    getConfig()
      .then(setConfig)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persistence (after hydration) ----
  useEffect(() => {
    if (mounted) saveString(STORAGE_KEYS.code, code);
  }, [code, mounted]);
  useEffect(() => {
    if (mounted) saveString(STORAGE_KEYS.stdin, stdin);
  }, [stdin, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE_KEYS.fontSize, fontSize);
  }, [fontSize, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE_KEYS.settings, settings);
  }, [settings, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE_KEYS.tests, tests);
  }, [tests, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE_KEYS.stress, stress);
  }, [stress, mounted]);
  useEffect(() => {
    if (mounted) saveJSON(STORAGE_KEYS.layout, layout);
  }, [layout, mounted]);
  useEffect(() => {
    if (mounted) saveString(STORAGE_KEYS.activeTab, activeTab);
  }, [activeTab, mounted]);
  useEffect(() => {
    if (mounted) saveString(STORAGE_KEYS.activeProblem, activeSlug ?? "");
  }, [activeSlug, mounted]);

  const dirty = useMemo(
    () =>
      savedSnapshot !== null &&
      savedSnapshot !== snapshot(code, tests, stdin, stress, settings),
    [savedSnapshot, code, tests, stdin, stress, settings],
  );

  // ---- Execution ----
  const handleRun = useCallback(async () => {
    if (!code.trim()) {
      toast.error("The editor is empty");
      return;
    }
    setRunLoading(true);
    setActiveTab("run");
    setRunResult(null);
    try {
      const res = await runCode(code, stdin, settings);
      setRunResult(res);
      setDiagnostics(res.compile.diagnostics ?? []);
      if (res.verdict === "CE") toast.error("Compilation error");
      else if (res.verdict === "TLE") toast.warning("Time limit exceeded");
      else if (res.verdict === "RE") toast.warning("Runtime error");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunLoading(false);
    }
  }, [code, stdin, settings]);

  const handleRunAll = useCallback(async () => {
    if (!code.trim()) {
      toast.error("The editor is empty");
      return;
    }
    if (tests.length === 0) {
      toast.error("Add at least one test case");
      return;
    }
    setTestLoading(true);
    setActiveTab("tests");
    setTestResult(null);
    try {
      const res = await runTests(code, toTestCases(tests), settings, {
        stopOnFirstFailure,
      });
      setTestResult(res);
      setDiagnostics(res.compile.diagnostics ?? []);
      if (res.summary.verdict === "CE") toast.error("Compilation error");
      else if (res.ok) toast.success(`All ${res.summary.total} cases passed`);
      else
        toast.error(
          `${res.summary.failed} of ${res.summary.total} case${res.summary.total === 1 ? "" : "s"} failed`,
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tests failed");
    } finally {
      setTestLoading(false);
    }
  }, [code, tests, settings, stopOnFirstFailure]);

  const handleRunOne = useCallback(
    async (id: number) => {
      const idx = tests.findIndex((t) => t.id === id);
      if (idx === -1) return;
      if (!code.trim()) {
        toast.error("The editor is empty");
        return;
      }
      setTestLoading(true);
      try {
        const res = await runTests(code, toTestCases([tests[idx]]), settings);
        setDiagnostics(res.compile.diagnostics ?? []);
        const single: TestCaseResult = { ...res.results[0], index: idx };
        setTestResult((prev) => {
          const results = (prev?.results ?? []).filter((r) => r.index !== idx);
          results.push(single);
          results.sort((a, b) => a.index - b.index);
          const passed = results.filter((r) => r.verdict === "AC").length;
          const worst = results.reduce(
            (acc, r) => (rank(r.verdict) > rank(acc) ? r.verdict : acc),
            single.verdict,
          );
          return {
            ...res,
            summary: {
              ...res.summary,
              total: results.length,
              passed,
              failed: results.length - passed,
              verdict: worst,
              maxTimeMs: results.reduce((m, r) => Math.max(m, r.timeMs), 0),
            },
            results,
          };
        });
        if (single.verdict === "AC") toast.success(`Case ${idx + 1}: AC`);
        else toast.error(`Case ${idx + 1}: ${single.verdict}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Test failed");
      } finally {
        setTestLoading(false);
      }
    },
    [code, tests, settings],
  );

  // ---- Problems library ----
  const currentProblemPayload = useCallback(
    (name: string) => ({
      name,
      code,
      tests: toTestCases(tests),
      stdin,
      brute: stress.brute,
      generator: stress.generator,
      settings,
    }),
    [code, tests, stdin, stress, settings],
  );

  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Enter a problem name first");
      return;
    }
    try {
      const saved = await saveProblem(currentProblemPayload(name));
      setActiveSlug(saved.slug);
      setSaveName(saved.name);
      setSavedSnapshot(snapshot(code, tests, stdin, stress, settings));
      await refreshProblems();
      toast.success(`Saved ${saved.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }, [
    saveName,
    currentProblemPayload,
    code,
    tests,
    stdin,
    stress,
    settings,
    refreshProblems,
  ]);

  const handleLoad = useCallback(
    async (slug: string) => {
      try {
        const problem = await getProblem(slug);
        const nextCode = problem.code || DEFAULT_CODE;
        const loaded = problem.tests.map((t) => ({
          id: nextId(),
          input: t.input,
          expected: t.expected,
        }));
        const nextStress: StressState = {
          brute: problem.brute || DEFAULT_STRESS.brute,
          generator: problem.generator || DEFAULT_STRESS.generator,
          iterations: stress.iterations,
        };
        const nextStdin = problem.stdin || problem.tests[0]?.input || "";
        const nextSettings = problem.settings
          ? normalizeSettings({ ...settings, ...problem.settings })
          : settings;
        setCode(nextCode);
        setTests(loaded);
        setStdin(nextStdin);
        setStress(nextStress);
        setSettings(nextSettings);
        setActiveSlug(problem.slug);
        setSaveName(problem.name);
        setRunResult(null);
        setTestResult(null);
        setDiagnostics([]);
        setSidebarOpen(false);
        setSavedSnapshot(
          snapshot(nextCode, loaded, nextStdin, nextStress, nextSettings),
        );
        toast.success(`Loaded ${problem.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      }
    },
    [nextId, stress.iterations, settings],
  );

  const handleRename = useCallback(
    async (slug: string, to: string) => {
      try {
        const renamed = await renameProblem(slug, to);
        if (activeSlug === slug) {
          setActiveSlug(renamed.slug);
          setSaveName(renamed.name);
        }
        await refreshProblems();
        toast.success(`Renamed to ${renamed.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Rename failed");
      }
    },
    [activeSlug, refreshProblems],
  );

  const handleDuplicate = useCallback(
    async (slug: string, to: string) => {
      try {
        const copy = await duplicateProblem(slug, to);
        await refreshProblems();
        toast.success(`Duplicated as ${copy.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Duplicate failed");
      }
    },
    [refreshProblems],
  );

  const handleDelete = useCallback(
    async (slug: string) => {
      try {
        await deleteProblem(slug);
        if (activeSlug === slug) {
          setActiveSlug(null);
          setSavedSnapshot(null);
        }
        await refreshProblems();
        toast.success("Deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [activeSlug, refreshProblems],
  );

  const handleNew = useCallback(() => {
    if (
      dirty &&
      !window.confirm("Discard unsaved changes and start a new workspace?")
    )
      return;
    setCode(DEFAULT_CODE);
    setTests(withIds(DEFAULT_TESTS, idRef.current));
    idRef.current += DEFAULT_TESTS.length;
    setStdin(DEFAULT_STDIN);
    setStress((s) => ({ ...DEFAULT_STRESS, iterations: s.iterations }));
    setRunResult(null);
    setTestResult(null);
    setDiagnostics([]);
    setActiveSlug(null);
    setSaveName("");
    setSavedSnapshot(null);
    setSidebarOpen(false);
    toast.success("New workspace");
  }, [dirty]);

  const handleExport = useCallback(async () => {
    try {
      const bundle = await exportProblems();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cf-problems-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${bundle.problems.length} problem(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const records = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object"
            ? (parsed as { problems?: unknown }).problems
            : undefined;
        if (!Array.isArray(records))
          throw new Error("File is not a cf problems export");
        const { imported, skipped } = await importProblems(records, false);
        await refreshProblems();
        toast.success(
          `Imported ${imported} problem(s)${skipped ? `, skipped ${skipped} existing` : ""}`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed");
      }
    },
    [refreshProblems],
  );

  // ---- Sample import from a statement ----
  const handleImportStatement = useCallback(
    async (statement: string): Promise<ParsedStatement | null> => {
      try {
        const parsed = await parseSamples(statement);
        if (parsed.tests.length === 0) {
          toast.error("No Input / Output samples found in the statement");
          return parsed;
        }
        const existingEmpty = tests.every(
          (t) => !t.input.trim() && !t.expected.trim(),
        );
        const isDefault =
          tests.length === DEFAULT_TESTS.length &&
          tests.every(
            (t, i) =>
              t.input === DEFAULT_TESTS[i].input &&
              t.expected === DEFAULT_TESTS[i].expected,
          );
        const fresh = parsed.tests.map((t) => ({ id: nextId(), ...t }));
        setTests(existingEmpty || isDefault ? fresh : [...tests, ...fresh]);
        setTestResult(null);
        if (parsed.timeLimitMs) {
          setSettings((s) => ({
            ...s,
            timeLimitMs: clampTimeLimit(parsed.timeLimitMs as number),
          }));
        }
        if (parsed.title && !saveName.trim()) setSaveName(parsed.title);
        if (!stdin.trim() || stdin === DEFAULT_STDIN)
          setStdin(parsed.tests[0].input);
        toast.success(
          `Imported ${parsed.tests.length} sample(s)${parsed.timeLimitMs ? `, time limit ${parsed.timeLimitMs} ms` : ""}`,
        );
        return parsed;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not parse statement",
        );
        return null;
      }
    },
    [tests, nextId, saveName, stdin],
  );

  const addTestCase = useCallback(
    (input: string, expected: string) => {
      setTests((t) => [...t, { id: nextId(), input, expected }]);
      setActiveTab("tests");
    },
    [nextId],
  );

  const useAsStdin = useCallback((input: string) => {
    setStdin(input);
    setActiveTab("run");
  }, []);

  // Editing the source or a case makes any prior verdict stale — drop it so the
  // UI never shows a result that no longer matches the editor. Functional
  // updates keep the same reference (no extra render) when already cleared.
  const invalidateResults = useCallback(() => {
    setRunResult((r) => (r ? null : r));
    setTestResult((r) => (r ? null : r));
    setDiagnostics((d) => (d.length ? [] : d));
  }, []);

  const handleCodeChange = useCallback(
    (next: string) => {
      setCode(next);
      invalidateResults();
    },
    [invalidateResults],
  );

  const handleTestsChange = useCallback((next: SampleTest[]) => {
    setTests(next);
    setTestResult((r) => (r ? null : r));
  }, []);

  const jumpToLine = useCallback((line: number) => {
    setGotoLine({ line, nonce: Date.now() });
  }, []);

  // ---- Keyboard shortcuts ----
  const runRef = useRef(handleRun);
  const runAllRef = useRef(handleRunAll);
  const saveRef = useRef(handleSave);
  const nameRef = useRef(saveName);
  useEffect(() => {
    runRef.current = handleRun;
    runAllRef.current = handleRunAll;
    saveRef.current = handleSave;
    nameRef.current = saveName;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) runAllRef.current();
        else runRef.current();
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        if (nameRef.current.trim()) saveRef.current();
        else toast.error("Enter a problem name in the sidebar to save");
      } else if (e.key.toLowerCase() === "b" && !e.shiftKey) {
        e.preventDefault();
        setSidebarHidden((h) => !h);
      } else if (!e.shiftKey && !e.altKey) {
        const tab = PANEL_TABS.find((t) => t.key === e.key);
        if (tab) {
          e.preventDefault();
          setActiveTab(tab.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeFont = (delta: number) =>
    setFontSize((s) =>
      Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, s + delta)),
    );

  const insertTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setCode(tpl.code);
    invalidateResults();
    toast.success(`Inserted “${tpl.label}” template`);
  };

  const activeName = useMemo(
    () => problems.find((p) => p.slug === activeSlug)?.name ?? null,
    [problems, activeSlug],
  );

  const markers = useMemo(() => markersFrom(diagnostics), [diagnostics]);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning",
  ).length;
  const lineCount = useMemo(() => code.split("\n").length, [code]);

  const onResize = useCallback((f: number) => {
    setLayout({
      panelFraction: Math.min(
        MAX_PANEL_FRACTION,
        Math.max(MIN_PANEL_FRACTION, f),
      ),
    });
  }, []);

  const compilerLabel = config?.compilerVersion
    ? config.compilerVersion.replace(/\s*\(.*?\)\s*/g, " ").trim()
    : config
      ? "no compiler"
      : null;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950 text-zinc-200">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle problems sidebar"
            data-testid="toggle-sidebar"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarHidden((h) => !h)}
            aria-label={
              sidebarHidden ? "Show problems sidebar" : "Hide problems sidebar"
            }
            data-testid="collapse-sidebar"
            title="Ctrl/⌘+B"
            className="hidden rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:block"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold tracking-tight text-zinc-100">
            cf
            <span className="ml-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              workbench
            </span>
          </span>
          {activeName ? (
            <span
              className="ml-2 flex items-center gap-1.5 truncate font-mono text-xs text-zinc-400"
              data-testid="active-problem"
            >
              {activeName}
              {dirty ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  title="Unsaved changes"
                />
              ) : null}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {compilerLabel ? (
            <span
              className={cn(
                "hidden max-w-[22rem] truncate font-mono text-[10px] lg:inline",
                config?.compilerVersion ? "text-zinc-600" : "text-red-400",
              )}
              title={config?.compilerVersion ?? "No C++ compiler detected"}
              data-testid="compiler-label"
            >
              {compilerLabel}
            </span>
          ) : null}
          <span
            className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:inline-flex"
            title="Ctrl/⌘+Enter run · Ctrl/⌘+Shift+Enter run all · Ctrl/⌘+S save · Ctrl/⌘+1-4 tabs · Ctrl/⌘+B sidebar · Ctrl/⌘+/ comment"
          >
            <Keyboard className="h-3 w-3" />
            ⌘/Ctrl + Enter
          </span>
          <button
            type="button"
            onClick={handleRun}
            disabled={runLoading}
            data-testid="run-button"
            aria-label="Run"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Problems sidebar */}
        <aside
          className={cn(
            "w-60 shrink-0 border-r border-zinc-800 bg-zinc-900",
            sidebarOpen ? "flex" : sidebarHidden ? "hidden" : "hidden md:flex",
          )}
        >
          <ProblemsSidebar
            problems={problems}
            activeSlug={activeSlug}
            dirty={dirty}
            saveName={saveName}
            onSaveNameChange={setSaveName}
            onSave={handleSave}
            onLoad={handleLoad}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onRefresh={refreshProblems}
            onNew={handleNew}
            onExport={handleExport}
            onImport={handleImport}
            busy={problemsBusy}
          />
        </aside>

        {/* Editor + panels */}
        <main ref={mainRef} className="flex min-w-0 flex-1 flex-col">
          {/* Editor */}
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3">
              <FileCode className="h-4 w-4 text-zinc-500" />
              <span className="font-mono text-xs text-zinc-300">
                solution.cpp
              </span>
              <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {settings.std}
              </span>
              {errorCount > 0 ? (
                <span
                  className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] text-red-400"
                  data-testid="error-count"
                >
                  {errorCount} error{errorCount === 1 ? "" : "s"}
                </span>
              ) : warningCount > 0 ? (
                <span
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-400"
                  data-testid="warning-count"
                >
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </span>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                <select
                  aria-label="Insert template"
                  data-testid="template-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertTemplate(e.target.value);
                    e.currentTarget.value = "";
                  }}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-zinc-600"
                >
                  <option value="">Templates…</option>
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center rounded-md border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => changeFont(-1)}
                    aria-label="Decrease font size"
                    data-testid="font-decrease"
                    className="px-1.5 py-1 text-zinc-400 hover:text-zinc-100"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center font-mono text-[10px] text-zinc-500">
                    {fontSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeFont(1)}
                    aria-label="Increase font size"
                    data-testid="font-increase"
                    className="px-1.5 py-1 text-zinc-400 hover:text-zinc-100"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {mounted ? (
                <CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  fontSize={fontSize}
                  markers={markers}
                  onCursorChange={setCursor}
                  gotoLine={gotoLine}
                />
              ) : (
                <div className="p-4 font-mono text-sm italic text-zinc-600">
                  Loading editor…
                </div>
              )}
            </div>
            <div
              className="flex h-6 shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[10px] text-zinc-500"
              data-testid="editor-status"
            >
              <span>
                Ln {cursor.line}, Col {cursor.column}
              </span>
              <span>{lineCount} lines</span>
              <span>{code.length} chars</span>
              <span className="ml-auto">
                {settings.timeLimitMs} ms · {settings.checker}
                {settings.compilerFlags.length
                  ? ` · ${settings.compilerFlags.join(" ")}`
                  : ""}
              </span>
            </div>
          </section>

          <Resizer
            containerRef={mainRef}
            onResize={onResize}
            onReset={() => setLayout(DEFAULT_LAYOUT)}
          />

          {/* Bottom panel */}
          <section
            className="flex min-h-0 shrink-0 flex-col bg-zinc-900"
            style={{ height: `${layout.panelFraction * 100}%` }}
            data-testid="bottom-panel"
          >
            <div
              className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-1"
              role="tablist"
              aria-label="Workbench panels"
            >
              {PANEL_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const busy =
                  (tab.id === "run" && runLoading) ||
                  (tab.id === "tests" && testLoading);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    title={`Ctrl/⌘+${tab.key}`}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition",
                      isActive
                        ? "border-emerald-500 text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {tab.label}
                    {tab.id === "tests" && testResult ? (
                      <span
                        className={cn(
                          "rounded px-1 font-mono text-[9px]",
                          testResult.ok
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400",
                        )}
                      >
                        {testResult.summary.passed}/{testResult.summary.total}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 bg-zinc-950">
              <div
                className={cn(
                  "h-full",
                  activeTab === "run" ? "block" : "hidden",
                )}
              >
                <RunPanel
                  result={runResult}
                  loading={runLoading}
                  stdin={stdin}
                  onStdinChange={setStdin}
                  onGotoLine={jumpToLine}
                  onClear={() => {
                    setRunResult(null);
                    setDiagnostics([]);
                  }}
                />
              </div>
              <div
                className={cn(
                  "h-full",
                  activeTab === "tests" ? "block" : "hidden",
                )}
              >
                <TestsPanel
                  tests={tests}
                  onChange={handleTestsChange}
                  nextId={nextId}
                  result={testResult}
                  loading={testLoading}
                  onRunAll={handleRunAll}
                  onRunOne={handleRunOne}
                  onUseAsStdin={useAsStdin}
                  onImportStatement={handleImportStatement}
                  onGotoLine={jumpToLine}
                  stopOnFirstFailure={stopOnFirstFailure}
                  onStopOnFirstFailureChange={setStopOnFirstFailure}
                />
              </div>
              <div
                className={cn(
                  "h-full",
                  activeTab === "stress" ? "block" : "hidden",
                )}
              >
                {mounted ? (
                  <StressPanel
                    solution={code}
                    brute={stress.brute}
                    generator={stress.generator}
                    iterations={stress.iterations}
                    fontSize={fontSize}
                    settings={settings}
                    onBruteChange={(brute) =>
                      setStress((s) => ({ ...s, brute }))
                    }
                    onGeneratorChange={(generator) =>
                      setStress((s) => ({ ...s, generator }))
                    }
                    onIterationsChange={(iterations) =>
                      setStress((s) => ({ ...s, iterations }))
                    }
                    onAddTestCase={addTestCase}
                    onUseAsStdin={useAsStdin}
                  />
                ) : null}
              </div>
              <div
                className={cn(
                  "h-full",
                  activeTab === "settings" ? "block" : "hidden",
                )}
              >
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={setSettings}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  config={config}
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const VERDICT_RANK: Record<string, number> = {
  AC: 0,
  SKIPPED: 0,
  WA: 1,
  TLE: 2,
  RE: 3,
  CE: 4,
};

function rank(v: string): number {
  return VERDICT_RANK[v] ?? 0;
}
