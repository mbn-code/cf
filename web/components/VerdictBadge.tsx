"use client";

import { cn } from "@/lib/utils";

/**
 * Colored verdict pill used by both the run and tests panels.
 *
 * Exposes a stable `data-testid="verdict-badge"` and a `data-verdict` attribute
 * carrying the raw verdict code so end-to-end tests can target it reliably.
 */

export type AnyVerdict =
  "OK" | "AC" | "WA" | "TLE" | "RE" | "CE" | "SKIPPED" | "PENDING";

const STYLES: Record<AnyVerdict, string> = {
  OK: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  AC: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  WA: "bg-red-500/15 text-red-400 border-red-500/30",
  TLE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  RE: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  CE: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  SKIPPED: "bg-zinc-700/30 text-zinc-500 border-zinc-600/40",
  PENDING: "bg-zinc-700/30 text-zinc-400 border-zinc-600/40",
};

const LABELS: Record<AnyVerdict, string> = {
  OK: "OK",
  AC: "AC",
  WA: "WA",
  TLE: "TLE",
  RE: "RE",
  CE: "CE",
  SKIPPED: "SKIP",
  PENDING: "…",
};

const TITLES: Record<AnyVerdict, string> = {
  OK: "Ran to completion with exit code 0",
  AC: "Accepted: output matches",
  WA: "Wrong answer: output differs",
  TLE: "Time limit exceeded",
  RE: "Runtime error: non-zero exit or signal",
  CE: "Compilation error",
  SKIPPED: "Skipped after an earlier failure",
  PENDING: "Pending",
};

export function VerdictBadge({
  verdict,
  testId,
  className,
}: {
  verdict: AnyVerdict;
  testId?: string;
  className?: string;
}) {
  return (
    <span
      data-testid={testId ?? "verdict-badge"}
      data-verdict={verdict}
      role="status"
      aria-label={`Verdict ${verdict}`}
      title={TITLES[verdict]}
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        STYLES[verdict],
        className,
      )}
    >
      {LABELS[verdict]}
    </span>
  );
}
