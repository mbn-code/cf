"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunResponse } from "@/lib/api";
import { VerdictBadge } from "./VerdictBadge";
import { Terminal } from "./Terminal";

/**
 * Run panel: a custom-stdin box, a metrics row (verdict, exit code, elapsed
 * time, compiler) and the scrollable raw terminal log carrying stdout, stderr
 * and any compile errors.
 */
export function RunPanel({
  result,
  loading,
  stdin,
  onStdinChange,
}: {
  result: RunResponse | null;
  loading: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
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

  return (
    <div className="flex h-full flex-col" data-testid="run-panel">
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/40 p-3">
        <label
          htmlFor="run-stdin"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-zinc-500"
        >
          Custom stdin
        </label>
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
              value={result.exitCode === null ? "—" : String(result.exitCode)}
            />
            <Metric
              label="time"
              value={`${result.timeMs} ms`}
              testId="elapsed-time"
            />
            <Metric label="compile" value={`${result.compile.ms} ms`} />
            {result.compiler ? (
              <Metric label="cc" value={shortCompiler(result.compiler)} />
            ) : null}
            {result.timedOut ? (
              <span className="font-semibold text-amber-400">timed out</span>
            ) : null}
            {result.truncated ? (
              <span className="font-semibold text-amber-400">
                output truncated
              </span>
            ) : null}
            {terminalText ? (
              <button
                type="button"
                onClick={handleCopy}
                data-testid="copy-log-button"
                aria-label="Copy raw log"
                className="ml-auto inline-flex items-center gap-1 rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-zinc-600">Run to see output.</span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Terminal text={terminalText} placeholder="Waiting for execution…" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded bg-zinc-800/60 px-2 py-0.5 font-mono"
    >
      <span className="text-[9px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className={cn("text-zinc-200")}>{value}</span>
    </span>
  );
}

function shortCompiler(path: string): string {
  const parts = path.split("/");
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
  if (sections.length === 0) {
    return "(no output)";
  }
  return sections.join("\n");
}
