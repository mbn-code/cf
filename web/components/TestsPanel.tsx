"use client";

import { useState } from "react";
import {
  Play,
  Plus,
  Trash2,
  ClipboardPaste,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TestResponse, TestCaseResult } from "@/lib/api";
import type { SampleTest } from "@/lib/storage";
import { VerdictBadge } from "./VerdictBadge";
import { DiffView } from "./DiffView";

/**
 * Tests panel: add / edit / delete sample cases, paste-and-split a clipboard
 * blob into input + expected, run every case via /api/test and render per-case
 * AC/WA/TLE/RE/CE badges with an expandable diff view.
 */
export function TestsPanel({
  tests,
  onChange,
  nextId,
  result,
  loading,
  onRunAll,
}: {
  tests: SampleTest[];
  onChange: (tests: SampleTest[]) => void;
  nextId: () => number;
  result: TestResponse | null;
  loading: boolean;
  onRunAll: () => void;
}) {
  // Only explicit user toggles are stored; a row's default open state is
  // derived from its latest verdict (failing cases auto-expand so the diff is
  // visible without an extra click). This avoids a setState-in-effect.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const update = (id: number, patch: Partial<SampleTest>) =>
    onChange(tests.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTest = () =>
    onChange([...tests, { id: nextId(), input: "", expected: "" }]);

  const removeTest = (id: number) => onChange(tests.filter((t) => t.id !== id));

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
        <button
          type="button"
          onClick={addTest}
          data-testid="add-test-button"
          aria-label="Add test case"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add case
        </button>
        <button
          type="button"
          onClick={pasteSplit}
          data-testid="paste-split-button"
          aria-label="Paste and split clipboard into a test case"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste split
        </button>

        {result ? (
          <span
            data-testid="tests-summary"
            className="ml-auto flex items-center gap-2 text-[11px] text-zinc-400"
          >
            <VerdictBadge
              verdict={result.summary.verdict}
              testId="tests-verdict"
            />
            <span className="font-mono">
              {result.summary.passed}/{result.summary.total} passed
            </span>
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tests.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-600">
            No sample cases yet. Add one or paste-split from the clipboard.
          </p>
        ) : (
          tests.map((t, i) => {
            const r = result?.results[i];
            const autoOpen = !!r && r.verdict !== "AC";
            const isOpen = t.id in overrides ? overrides[t.id] : autoOpen;
            return (
              <div
                key={t.id}
                data-testid={`test-case-${i}`}
                className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30"
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
                  <button
                    type="button"
                    onClick={() => removeTest(t.id)}
                    data-testid={`delete-test-${i}`}
                    aria-label={`Delete test case ${i + 1}`}
                    className="ml-auto rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
      <span className="font-mono text-[10px] text-zinc-500">
        {result.timeMs} ms
      </span>
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
      {result.verdict !== "AC" && result.diff.length === 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Block label="Expected" value={result.expected} />
          <Block label="Actual" value={result.actual} />
        </div>
      ) : null}
      {result.stderr ? (
        <Block label="stderr" value={result.stderr} tone="error" />
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
      <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
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
function splitClipboard(text: string): { input: string; expected: string } {
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
