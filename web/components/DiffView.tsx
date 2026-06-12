"use client";

import { cn } from "@/lib/utils";
import type { DiffLine } from "@/lib/api";

/**
 * Line-by-line expected-vs-actual diff. Differing lines are tinted red; the
 * server only sends differing lines for a WA verdict but this renders whatever
 * it is given. Used by the tests panel and the stress panel.
 */
export function DiffView({
  diff,
  testId,
  className,
}: {
  diff: DiffLine[];
  testId?: string;
  className?: string;
}) {
  if (!diff || diff.length === 0) return null;

  return (
    <div
      data-testid={testId ?? "diff-view"}
      className={cn(
        "overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 font-mono text-[11px]",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3">
        <div className="border-b border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Ln
        </div>
        <div className="border-b border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Expected
        </div>
        <div className="border-b border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Actual
        </div>
        {diff.map((d) => (
          <DiffRow key={d.line} line={d} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const cellBase = "px-2 py-0.5 whitespace-pre-wrap break-all";
  return (
    <>
      <div className={cn(cellBase, "text-right text-zinc-600")}>
        {line.line}
      </div>
      <div
        className={cn(
          cellBase,
          line.same ? "text-zinc-400" : "bg-emerald-500/5 text-emerald-300",
        )}
      >
        {line.expected || " "}
      </div>
      <div
        className={cn(
          cellBase,
          line.same ? "text-zinc-400" : "bg-red-500/10 text-red-300",
        )}
      >
        {line.actual || " "}
      </div>
    </>
  );
}
