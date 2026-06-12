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
  deleteProblem,
  type RunResponse,
  type TestResponse,
  type RunSettings,
  type ProblemSummary,
} from "@/lib/api";
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_TESTS,
  loadJSON,
  loadString,
  saveJSON,
  saveString,
  normalizeSettings,
  toTestCases,
  type SampleTest,
} from "@/lib/storage";
import {
  DEFAULT_CODE,
  TEMPLATES,
  BRUTE_TEMPLATE,
  GENERATOR_TEMPLATE,
} from "@/lib/templates";

import { CodeEditor } from "@/components/CodeEditor";
import { RunPanel } from "@/components/RunPanel";
import { TestsPanel } from "@/components/TestsPanel";
import { StressPanel } from "@/components/StressPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ProblemsSidebar } from "@/components/ProblemsSidebar";

type PanelTab = "run" | "tests" | "stress" | "settings";

const PANEL_TABS: { id: PanelTab; label: string; icon: ElementType }[] = [
  { id: "run", label: "Run", icon: TerminalIcon },
  { id: "tests", label: "Tests", icon: FlaskConical },
  { id: "stress", label: "Stress", icon: Swords },
  { id: "settings", label: "Settings", icon: SettingsIcon },
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
  const [stdin, setStdin] = useState("2 3\n");

  // Execution results.
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Problems library.
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [problemsBusy, setProblemsBusy] = useState(false);

  // Layout.
  const [activeTab, setActiveTab] = useState<PanelTab>("run");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const storedFont = loadJSON<number>(
      STORAGE_KEYS.fontSize,
      DEFAULT_FONT_SIZE,
    );
    setFontSize(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, storedFont)));
    setSettings(
      normalizeSettings(loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS)),
    );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persistence (after hydration) ----
  useEffect(() => {
    if (mounted) saveString(STORAGE_KEYS.code, code);
  }, [code, mounted]);
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
    if (mounted) saveString(STORAGE_KEYS.activeProblem, activeSlug ?? "");
  }, [activeSlug, mounted]);

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
      if (res.verdict === "CE") toast.error("Compilation error");
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
      const res = await runTests(code, toTestCases(tests), settings);
      setTestResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tests failed");
    } finally {
      setTestLoading(false);
    }
  }, [code, tests, settings]);

  // ---- Problems library ----
  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Enter a problem name first");
      return;
    }
    try {
      const saved = await saveProblem({
        name,
        code,
        tests: toTestCases(tests),
      });
      setActiveSlug(saved.slug);
      setSaveName(saved.name);
      await refreshProblems();
      toast.success(`Saved ${saved.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }, [saveName, code, tests, refreshProblems]);

  const handleLoad = useCallback(
    async (slug: string) => {
      try {
        const problem = await getProblem(slug);
        setCode(problem.code || DEFAULT_CODE);
        const loaded = problem.tests.map((t) => ({
          id: nextId(),
          input: t.input,
          expected: t.expected,
        }));
        setTests(loaded);
        setActiveSlug(problem.slug);
        setSaveName(problem.name);
        setRunResult(null);
        setTestResult(null);
        setSidebarOpen(false);
        toast.success(`Loaded ${problem.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      }
    },
    [nextId],
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

  const handleDelete = useCallback(
    async (slug: string) => {
      try {
        await deleteProblem(slug);
        if (activeSlug === slug) setActiveSlug(null);
        await refreshProblems();
        toast.success("Deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [activeSlug, refreshProblems],
  );

  // Editing the source or a case makes any prior verdict stale — drop it so the
  // UI never shows a result that no longer matches the editor. Functional
  // updates keep the same reference (no extra render) when already cleared.
  const invalidateResults = useCallback(() => {
    setRunResult((r) => (r ? null : r));
    setTestResult((r) => (r ? null : r));
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

  // ---- Keyboard shortcuts (Cmd/Ctrl+Enter run, +Shift run all, Cmd/Ctrl+S save) ----
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
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (nameRef.current.trim()) saveRef.current();
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
          <span className="text-sm font-bold tracking-tight text-zinc-100">
            cf
            <span className="ml-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              workbench
            </span>
          </span>
          {activeName ? (
            <span
              className="ml-2 truncate font-mono text-xs text-zinc-400"
              data-testid="active-problem"
            >
              {activeName}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:inline">
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
            sidebarOpen ? "flex" : "hidden md:flex",
          )}
        >
          <ProblemsSidebar
            problems={problems}
            activeSlug={activeSlug}
            saveName={saveName}
            onSaveNameChange={setSaveName}
            onSave={handleSave}
            onLoad={handleLoad}
            onRename={handleRename}
            onDelete={handleDelete}
            onRefresh={refreshProblems}
            busy={problemsBusy}
          />
        </aside>

        {/* Editor + panels */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Editor */}
          <section className="flex min-h-0 flex-1 flex-col border-b border-zinc-800">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3">
              <FileCode className="h-4 w-4 text-zinc-500" />
              <span className="font-mono text-xs text-zinc-300">
                solution.cpp
              </span>
              <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {settings.std}
              </span>

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
                />
              ) : (
                <div className="p-4 font-mono text-sm italic text-zinc-600">
                  Loading editor…
                </div>
              )}
            </div>
          </section>

          {/* Bottom panel */}
          <section className="flex h-[44%] min-h-0 shrink-0 flex-col bg-zinc-900">
            <div
              className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-1"
              role="tablist"
              aria-label="Workbench panels"
            >
              {PANEL_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition",
                      isActive
                        ? "text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
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
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
