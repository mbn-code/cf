"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Eraser, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunResponse } from "@/lib/api";
import { VerdictBadge } from "./VerdictBadge";
import { Terminal } from "./Terminal";
import { DiagnosticsList, RejectedFlagsNotice } from "./DiagnosticsList";

/**
 * Run panel: a custom-stdin box, a metrics row (verdict, exit code, elapsed
 * time, compiler, cache state), a clickable compiler-diagnostics list and the
 * scrollable raw terminal log carrying stdout, stderr and any compile errors.
 */
export function RunPanel({
  result,
  loading,
  stdin,
  onStdinChange,
  onGotoLine,
  onClear,
}: {
  result: RunResponse | null;
  loading: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
  onGotoLine?: (line: number) => void;
  onClear?: () => void;
}) {
  const terminalText = buildTerminalText(result);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(terminalText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (insecure context / denied) — non-fatal.
    }
  };

  const diagnostics = result?.compile.diagnostics ?? [];
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const errors = diagnostics.filter((d) => d.severity === "error").length;

  return (
    <div className="flex h-full flex-col" data-testid="run-panel">
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/40 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="run-stdin"
            className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500"
          >
            Custom stdin
          </label>
          <span className="font-mono text-[10px] text-zinc-600">
            {stdin.length} chars
          </span>
        </div>
        <textarea
          id="run-stdin"
          data-testid="run-stdin"
          aria-label="Custom standard input"
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          spellCheck={false}
          placeholder="Input fed to the program on Run…"
          className="h-16 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
        />
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/20 px-3 py-2 text-[11px] text-zinc-400"
        data-testid="run-metrics"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Compiling and running…
          </span>
        ) : result ? (
          <>
            <VerdictBadge verdict={result.verdict} testId="run-verdict" />
            <Metric
              label="exit"
              value={
                result.exitCode === null
                  ? (result.signal ?? "—")
                  : String(result.exitCode)
              }
            />
            <Metric
              label="time"
              value={`${formatMs(result.timeMs)} ms`}
              testId="elapsed-time"
            />
            <Metric
              label="compile"
              value={
                result.compile.cached
                  ? "cached"
                  : `${formatMs(result.compile.ms)} ms`
              }
              testId="compile-time"
              icon={result.compile.cached ? Zap : undefined}
            />
            {result.compiler ? (
              <Metric label="cc" value={shortCompiler(result.compiler)} />
            ) : null}
            {warnings > 0 ? (
              <span className="font-semibold text-amber-400">
                {warnings} warning{warnings === 1 ? "" : "s"}
              </span>
            ) : null}
            {errors > 0 ? (
              <span className="font-semibold text-red-400">
                {errors} error{errors === 1 ? "" : "s"}
              </span>
            ) : null}
            {result.timedOut ? (
              <span className="font-semibold text-amber-400">timed out</span>
            ) : null}
            {result.truncated ? (
              <span className="font-semibold text-amber-400">
                output truncated
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              {terminalText ? (
                <ToolButton
                  onClick={handleCopy}
                  testId="copy-log-button"
                  label="Copy raw log"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </ToolButton>
              ) : null}
              {onClear ? (
                <ToolButton
                  onClick={onClear}
                  testId="clear-run-button"
                  label="Clear result"
                >
                  <Eraser className="h-3 w-3" />
                  Clear
                </ToolButton>
              ) : null}
            </span>
          </>
        ) : (
          <span className="text-zinc-600">
            Run to see output. Ctrl/⌘+Enter runs, Ctrl/⌘+Shift+Enter runs all
            tests.
          </span>
        )}
      </div>

      {result ? (
        <div className="shrink-0 space-y-2 empty:hidden">
          <RejectedFlagsNotice
            flags={result.compile.rejectedFlags}
            className="mx-3 mt-2"
          />
          {diagnostics.length > 0 ? (
            <div className="max-h-32 overflow-y-auto border-b border-zinc-800 bg-zinc-900/30 px-1.5 py-1">
              <DiagnosticsList
                diagnostics={diagnostics}
                onGotoLine={onGotoLine}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <Terminal text={terminalText} placeholder="Waiting for execution…" />
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  testId,
  label,
  children,
}: {
  onClick: () => void;
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  testId,
  icon: Icon,
}: {
  label: string;
  value: string;
  testId?: string;
  icon?: React.ElementType;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded bg-zinc-800/60 px-2 py-0.5 font-mono"
    >
      <span className="text-[9px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      {Icon ? <Icon className="h-3 w-3 text-emerald-400" /> : null}
      <span className={cn("text-zinc-200")}>{value}</span>
    </span>
  );
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return ms >= 100 ? String(Math.round(ms)) : ms.toFixed(1);
}

function shortCompiler(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function buildTerminalText(result: RunResponse | null): string {
  if (!result) return "";
  if (result.verdict === "CE") {
    return result.compile.stderr || "Compilation error.";
  }
  const sections: string[] = [];
  if (result.stdout) sections.push(result.stdout.replace(/\n$/, ""));
  if (result.stderr) {
    sections.push(`──── stderr ────\n${result.stderr.replace(/\n$/, "")}`);
  }
  if (result.compile.stderr) {
    sections.push(
      `──── compiler ────\n${result.compile.stderr.replace(/\n$/, "")}`,
    );
  }
  if (sections.length === 0) {
    return "(no output)";
  }
  return sections.join("\n");
}
