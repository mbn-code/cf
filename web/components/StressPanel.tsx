"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Swords, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  runStress,
  ApiError,
  type RunSettings,
  type StressResponse,
  type StressFailure,
} from "@/lib/api";
import { CodeEditor } from "./CodeEditor";
import { DiffView } from "./DiffView";

/**
 * Stress panel: brute-force and generator editors plus an iteration count.
 * Runs /api/stress against the current solution and surfaces the first failing
 * input. Degrades gracefully when the endpoint is missing or errors.
 */
export function StressPanel({
  solution,
  brute,
  generator,
  iterations,
  fontSize,
  settings,
  onBruteChange,
  onGeneratorChange,
  onIterationsChange,
}: {
  solution: string;
  brute: string;
  generator: string;
  iterations: number;
  fontSize: number;
  settings: RunSettings;
  onBruteChange: (value: string) => void;
  onGeneratorChange: (value: string) => void;
  onIterationsChange: (value: number) => void;
}) {
  const [result, setResult] = useState<StressResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setUnavailable(false);
    setResult(null);
    try {
      const res = await runStress(
        { solution, brute, generator, iterations },
        settings,
      );
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        setUnavailable(true);
      } else {
        setError(
          e instanceof Error ? e.message : "Stress run failed unexpectedly",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col" data-testid="stress-panel">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          data-testid="stress-run-button"
          aria-label="Run stress test"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Swords className="h-3.5 w-3.5" />
          )}
          Run stress
        </button>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="font-bold uppercase tracking-widest text-zinc-500">
            Iterations
          </span>
          <input
            type="number"
            min={1}
            max={5000}
            value={iterations}
            onChange={(e) =>
              onIterationsChange(clampIterations(e.target.value, iterations))
            }
            data-testid="stress-iterations"
            aria-label="Stress iterations"
            className="w-20 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-center font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
        </label>
        <span className="text-[10px] text-zinc-600">
          solution (editor) vs brute, on generator inputs
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-px overflow-hidden bg-zinc-800 lg:grid-cols-2 lg:grid-rows-1">
        <EditorSection
          title="Brute force"
          subtitle="reference solution"
          value={brute}
          onChange={onBruteChange}
          fontSize={fontSize}
          testId="stress-brute-editor"
          ariaLabel="Brute force source"
        />
        <EditorSection
          title="Generator"
          subtitle="seed via argv[1]"
          value={generator}
          onChange={onGeneratorChange}
          fontSize={fontSize}
          testId="stress-generator-editor"
          ariaLabel="Generator source"
        />
      </div>

      <div
        className="max-h-[45%] shrink-0 overflow-y-auto border-t border-zinc-800 bg-zinc-950"
        data-testid="stress-result"
      >
        <StressResult
          loading={loading}
          unavailable={unavailable}
          error={error}
          result={result}
        />
      </div>
    </div>
  );
}

function EditorSection({
  title,
  subtitle,
  value,
  onChange,
  fontSize,
  testId,
  ariaLabel,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (value: string) => void;
  fontSize: number;
  testId: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex min-h-0 flex-col bg-zinc-900">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
          {title}
        </span>
        <span className="text-[10px] text-zinc-600">{subtitle}</span>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          fontSize={fontSize}
          minLines={10}
          testId={testId}
          ariaLabel={ariaLabel}
        />
      </div>
    </div>
  );
}

function StressResult({
  loading,
  unavailable,
  error,
  result,
}: {
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  result: StressResponse | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Compiling three sources and searching for a counter-example…
      </div>
    );
  }
  if (unavailable) {
    return (
      <Notice tone="warn">
        The stress endpoint is not available in this build. The brute and
        generator sources are still saved for later.
      </Notice>
    );
  }
  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }
  if (!result) {
    return (
      <p className="p-4 text-xs text-zinc-600">
        Provide a brute force and a generator, then run a stress search.
      </p>
    );
  }

  const compileFailed =
    !result.compile.solution.ok ||
    !result.compile.brute.ok ||
    !result.compile.generator.ok;

  if (compileFailed) {
    const which = !result.compile.solution.ok
      ? { label: "solution", stderr: result.compile.solution.stderr }
      : !result.compile.brute.ok
        ? { label: "brute", stderr: result.compile.brute.stderr }
        : { label: "generator", stderr: result.compile.generator.stderr };
    return (
      <div className="p-3">
        <Notice tone="error">Compilation failed for {which.label}.</Notice>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-red-300">
          {which.stderr}
        </pre>
      </div>
    );
  }

  if (result.failed && result.firstFailure) {
    return <Failure failure={result.firstFailure} />;
  }

  return (
    <div className="flex items-center gap-2 p-4 text-xs text-emerald-400">
      <CheckCircle2 className="h-4 w-4" />
      {result.message}
    </div>
  );
}

function Failure({ failure }: { failure: StressFailure }) {
  return (
    <div className="space-y-2 p-3" data-testid="stress-failure">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {failure.reason}
        </span>
        <span className="font-mono text-zinc-500">
          iteration {failure.iteration} · seed {failure.seed}
        </span>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Failing input
        </div>
        <pre
          data-testid="stress-failure-input"
          className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-amber-200"
        >
          {failure.input || "(empty)"}
        </pre>
      </div>

      {failure.diff.length > 0 ? (
        <DiffView diff={failure.diff} testId="stress-diff" />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <OutBlock label="Brute output" value={failure.bruteOutput} />
          <OutBlock label="Solution output" value={failure.solutionOutput} />
        </div>
      )}
    </div>
  );
}

function OutBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-300">
        {value || " "}
      </pre>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "m-3 rounded-md border px-3 py-2 text-xs",
        tone === "warn"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-red-500/30 bg-red-500/10 text-red-300",
      )}
    >
      {children}
    </div>
  );
}

function clampIterations(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5000, Math.max(1, n));
}
