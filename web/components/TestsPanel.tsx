"use client";

import { useState } from "react";
import {
  Play,
  Plus,
  Trash2,
  ClipboardPaste,
  ChevronRight,
  Loader2,
  FileText,
  Copy,
  Terminal as TerminalIcon,
  ChevronsDownUp,
  ChevronsUpDown,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TestResponse, TestCaseResult, ParsedStatement } from "@/lib/api";
import type { SampleTest } from "@/lib/storage";
import { VerdictBadge } from "./VerdictBadge";
import { DiffView } from "./DiffView";
import { DiagnosticsList, RejectedFlagsNotice } from "./DiagnosticsList";
import { formatMs } from "./RunPanel";

/**
 * Tests panel: add / edit / duplicate / delete sample cases, paste-and-split
 * a clipboard blob into input + expected, import every sample from a pasted
 * problem statement, run all cases (or a single one) via /api/test and render
 * per-case AC/WA/TLE/RE/CE badges with an expandable diff view.
 */
export function TestsPanel({
  tests,
  onChange,
  nextId,
  result,
  loading,
  onRunAll,
  onRunOne,
  onUseAsStdin,
  onImportStatement,
  onGotoLine,
  stopOnFirstFailure,
  onStopOnFirstFailureChange,
}: {
  tests: SampleTest[];
  onChange: (tests: SampleTest[]) => void;
  nextId: () => number;
  result: TestResponse | null;
  loading: boolean;
  onRunAll: () => void;
  onRunOne?: (id: number) => void;
  onUseAsStdin?: (input: string) => void;
  onImportStatement?: (statement: string) => Promise<ParsedStatement | null>;
  onGotoLine?: (line: number) => void;
  stopOnFirstFailure?: boolean;
  onStopOnFirstFailureChange?: (v: boolean) => void;
}) {
  // Only explicit user toggles are stored; a row's default open state is
  // derived from its latest verdict (failing cases auto-expand so the diff is
  // visible without an extra click). This avoids a setState-in-effect.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  const update = (id: number, patch: Partial<SampleTest>) =>
    onChange(tests.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTest = () =>
    onChange([...tests, { id: nextId(), input: "", expected: "" }]);

  const removeTest = (id: number) => onChange(tests.filter((t) => t.id !== id));

  const duplicateTest = (id: number) => {
    const idx = tests.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const copy = { ...tests[idx], id: nextId() };
    onChange([...tests.slice(0, idx + 1), copy, ...tests.slice(idx + 1)]);
  };

  const pasteSplit = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("Clipboard is empty");
        return;
      }
      const { input, expected } = splitClipboard(text);
      onChange([...tests, { id: nextId(), input, expected }]);
      toast.success("Pasted clipboard into a new case");
    } catch {
      toast.error("Clipboard access was denied");
    }
  };

  const runImport = async () => {
    if (!onImportStatement || !importText.trim()) return;
    setImporting(true);
    try {
      const parsed = await onImportStatement(importText);
      if (parsed && parsed.tests.length > 0) {
        setImportOpen(false);
        setImportText("");
      }
    } finally {
      setImporting(false);
    }
  };

  const setAll = (open: boolean) =>
    setOverrides(Object.fromEntries(tests.map((t) => [t.id, open])));

  const summary = result?.summary;

  return (
    <div className="flex h-full flex-col" data-testid="tests-panel">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <button
          type="button"
          onClick={onRunAll}
          disabled={loading || tests.length === 0}
          data-testid="run-all-button"
          aria-label="Run all tests"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run all
        </button>
        <ToolbarButton
          onClick={addTest}
          testId="add-test-button"
          label="Add test case"
        >
          <Plus className="h-3.5 w-3.5" />
          Add case
        </ToolbarButton>
        <ToolbarButton
          onClick={pasteSplit}
          testId="paste-split-button"
          label="Paste and split clipboard into a test case"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste split
        </ToolbarButton>
        {onImportStatement ? (
          <ToolbarButton
            onClick={() => setImportOpen((o) => !o)}
            testId="import-statement-button"
            label="Import samples from a problem statement"
            active={importOpen}
          >
            <FileText className="h-3.5 w-3.5" />
            From statement
          </ToolbarButton>
        ) : null}
        {onStopOnFirstFailureChange ? (
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
            <input
              type="checkbox"
              checked={!!stopOnFirstFailure}
              onChange={(e) => onStopOnFirstFailureChange(e.target.checked)}
              data-testid="stop-on-first-failure"
              className="accent-emerald-500"
            />
            Stop on fail
          </label>
        ) : null}

        <span className="ml-auto flex items-center gap-2 text-[11px] text-zinc-400">
          {tests.length > 1 ? (
            <>
              <IconOnly
                label="Expand all"
                testId="expand-all-button"
                onClick={() => setAll(true)}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </IconOnly>
              <IconOnly
                label="Collapse all"
                testId="collapse-all-button"
                onClick={() => setAll(false)}
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </IconOnly>
            </>
          ) : null}
          {result && summary ? (
            <span
              data-testid="tests-summary"
              className="flex items-center gap-2"
            >
              <VerdictBadge verdict={summary.verdict} testId="tests-verdict" />
              <span className="font-mono">
                {summary.passed}/{summary.total} passed
              </span>
              {summary.maxTimeMs !== undefined ? (
                <span className="font-mono text-[10px] text-zinc-500">
                  max {formatMs(summary.maxTimeMs)} ms
                </span>
              ) : null}
              {result.compile.cached ? (
                <Zap
                  className="h-3 w-3 text-emerald-400"
                  aria-label="Compiled binary served from cache"
                />
              ) : null}
            </span>
          ) : null}
        </span>
      </div>

      {importOpen ? (
        <div
          className="shrink-0 space-y-2 border-b border-zinc-800 bg-zinc-900/30 p-3"
          data-testid="import-statement-panel"
        >
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            data-testid="import-statement-text"
            aria-label="Problem statement to import samples from"
            spellCheck={false}
            placeholder={
              "Paste the whole Codeforces problem statement here. Every Input / Output pair under Examples becomes a test case; the time limit is applied to Settings."
            }
            className="h-28 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runImport}
              disabled={importing || !importText.trim()}
              data-testid="import-statement-submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Import samples
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="shrink-0 space-y-2 empty:hidden">
          <RejectedFlagsNotice
            flags={result.compile.rejectedFlags}
            className="mx-3 mt-2"
          />
          {result.compile.diagnostics &&
          result.compile.diagnostics.length > 0 ? (
            <div className="max-h-28 overflow-y-auto border-b border-zinc-800 bg-zinc-900/30 px-1.5 py-1">
              <DiagnosticsList
                diagnostics={result.compile.diagnostics}
                onGotoLine={onGotoLine}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tests.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-600">
            No sample cases yet. Add one, paste-split from the clipboard, or
            import them from the problem statement.
          </p>
        ) : (
          tests.map((t, i) => {
            const r = result?.results.find((x) => x.index === i);
            const autoOpen =
              !!r && r.verdict !== "AC" && r.verdict !== "SKIPPED";
            const isOpen = t.id in overrides ? overrides[t.id] : autoOpen;
            return (
              <div
                key={t.id}
                data-testid={`test-case-${i}`}
                className={cn(
                  "overflow-hidden rounded-lg border bg-zinc-900/30",
                  r?.verdict === "AC"
                    ? "border-emerald-500/20"
                    : r && r.verdict !== "SKIPPED"
                      ? "border-red-500/20"
                      : "border-zinc-800",
                )}
              >
                <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOverrides((o) => ({ ...o, [t.id]: !isOpen }))
                    }
                    aria-label={isOpen ? "Collapse case" : "Expand case"}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />
                    Case {i + 1}
                  </button>
                  {r ? (
                    <RowMetrics result={r} index={i} />
                  ) : (
                    <span className="text-[10px] text-zinc-600">not run</span>
                  )}
                  <span className="ml-auto flex items-center">
                    {onRunOne ? (
                      <IconOnly
                        label={`Run test case ${i + 1}`}
                        testId={`run-test-${i}`}
                        onClick={() => onRunOne(t.id)}
                        disabled={loading}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </IconOnly>
                    ) : null}
                    {onUseAsStdin ? (
                      <IconOnly
                        label={`Use test case ${i + 1} input as stdin`}
                        testId={`stdin-test-${i}`}
                        onClick={() => {
                          onUseAsStdin(t.input);
                          toast.success(`Case ${i + 1} input copied to stdin`);
                        }}
                      >
                        <TerminalIcon className="h-3.5 w-3.5" />
                      </IconOnly>
                    ) : null}
                    <IconOnly
                      label={`Duplicate test case ${i + 1}`}
                      testId={`duplicate-test-${i}`}
                      onClick={() => duplicateTest(t.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </IconOnly>
                    <IconOnly
                      label={`Delete test case ${i + 1}`}
                      testId={`delete-test-${i}`}
                      onClick={() => removeTest(t.id)}
                      tone="danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconOnly>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-px bg-zinc-800 sm:grid-cols-2">
                  <Field
                    label="Input"
                    value={t.input}
                    testId={`test-input-${i}`}
                    ariaLabel={`Test case ${i + 1} input`}
                    onChange={(v) => update(t.id, { input: v })}
                  />
                  <Field
                    label="Expected"
                    value={t.expected}
                    testId={`test-expected-${i}`}
                    ariaLabel={`Test case ${i + 1} expected output`}
                    onChange={(v) => update(t.id, { expected: v })}
                  />
                </div>

                {isOpen && r ? <RowDetail result={r} index={i} /> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  testId,
  label,
  active,
  children,
}: {
  onClick: () => void;
  testId: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition",
        active
          ? "border-zinc-500 bg-zinc-700"
          : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700",
      )}
    >
      {children}
    </button>
  );
}

function IconOnly({
  label,
  testId,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  testId?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1 text-zinc-500 transition disabled:opacity-40",
        tone === "danger"
          ? "hover:bg-red-500/10 hover:text-red-400"
          : "hover:bg-zinc-800 hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}

function RowMetrics({
  result,
  index,
}: {
  result: TestCaseResult;
  index: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <VerdictBadge
        verdict={result.verdict}
        testId={`verdict-badge-${index}`}
      />
      {result.verdict !== "SKIPPED" ? (
        <span className="font-mono text-[10px] text-zinc-500">
          {formatMs(result.timeMs)} ms
        </span>
      ) : null}
      {result.presentationOnly ? (
        <span
          className="text-[10px] text-amber-400"
          data-testid={`presentation-hint-${index}`}
          title="Tokens match; only whitespace differs. Switch the checker to Tokens if the judge accepts any layout."
        >
          whitespace only
        </span>
      ) : null}
    </span>
  );
}

function RowDetail({
  result,
  index,
}: {
  result: TestCaseResult;
  index: number;
}) {
  return (
    <div className="space-y-2 border-t border-zinc-800 bg-zinc-950/60 p-3">
      {result.diff.length > 0 ? (
        <DiffView diff={result.diff} testId={`diff-view-${index}`} />
      ) : null}
      {(result.verdict === "AC" || result.diff.length === 0) &&
      result.verdict !== "CE" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Block label="Expected" value={result.expected} />
          <Block label="Actual" value={result.actual} />
        </div>
      ) : null}
      {result.stderr ? (
        <Block label="stderr" value={result.stderr} tone="error" />
      ) : null}
      {result.truncated ? (
        <p className="text-[10px] text-amber-400">output truncated</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  testId,
  ariaLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  ariaLabel: string;
}) {
  return (
    <div className="bg-zinc-900/30">
      <div className="flex items-baseline justify-between px-3 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-[9px] text-zinc-700">
          {value.length
            ? `${value.split("\n").length - (value.endsWith("\n") ? 1 : 0)} ln`
            : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        aria-label={ariaLabel}
        spellCheck={false}
        className="h-24 w-full resize-y bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 outline-none"
      />
    </div>
  );
}

function Block({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "error";
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <pre
        className={cn(
          "max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px]",
          tone === "error" ? "text-red-300" : "text-zinc-300",
        )}
      >
        {value || " "}
      </pre>
    </div>
  );
}

/** Split a pasted blob into input / expected on a `---` line or a blank line. */
export function splitClipboard(text: string): {
  input: string;
  expected: string;
} {
  const normalized = text.replace(/\r\n/g, "\n");
  const sep = normalized.match(/\n[-=]{3,}\n/);
  if (sep && sep.index !== undefined) {
    return {
      input: trimBlock(normalized.slice(0, sep.index)),
      expected: trimBlock(normalized.slice(sep.index + sep[0].length)),
    };
  }
  const blank = normalized.indexOf("\n\n");
  if (blank !== -1) {
    return {
      input: trimBlock(normalized.slice(0, blank)),
      expected: trimBlock(normalized.slice(blank + 2)),
    };
  }
  return { input: trimBlock(normalized), expected: "" };
}

function trimBlock(s: string): string {
  const t = s.replace(/^\n+/, "").replace(/\s+$/, "");
  return t ? `${t}\n` : "";
}
