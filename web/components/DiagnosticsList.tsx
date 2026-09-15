"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Diagnostic, RejectedFlag } from "@/lib/api";

/**
 * Compact list of compiler diagnostics. Entries with a line number are
 * buttons that jump the editor to that line; notes render muted.
 */
export function DiagnosticsList({
  diagnostics,
  onGotoLine,
  testId = "diagnostics-list",
  className,
}: {
  diagnostics: Diagnostic[];
  onGotoLine?: (line: number) => void;
  testId?: string;
  className?: string;
}) {
  if (diagnostics.length === 0) return null;
  return (
    <ul
      data-testid={testId}
      className={cn("space-y-0.5 font-mono text-[11px]", className)}
    >
      {diagnostics.map((d, i) => {
        const Icon =
          d.severity === "error"
            ? AlertCircle
            : d.severity === "warning"
              ? AlertTriangle
              : Info;
        const tone =
          d.severity === "error"
            ? "text-red-300"
            : d.severity === "warning"
              ? "text-amber-300"
              : "text-zinc-500";
        const clickable = d.line !== null && !!onGotoLine;
        const body = (
          <>
            <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", tone)} />
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {d.line !== null ? (
                <span className="mr-1.5 text-zinc-500">
                  {d.line}
                  {d.column !== null ? `:${d.column}` : ""}
                </span>
              ) : null}
              <span className={tone}>{d.message}</span>
            </span>
          </>
        );
        return (
          <li key={i} data-severity={d.severity}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onGotoLine?.(d.line as number)}
                className="flex w-full items-start gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-zinc-800/60"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-1.5 px-1.5 py-0.5">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Notice listing compiler flags the server dropped, with reasons. */
export function RejectedFlagsNotice({
  flags,
  className,
}: {
  flags: RejectedFlag[] | undefined;
  className?: string;
}) {
  if (!flags || flags.length === 0) return null;
  return (
    <div
      data-testid="rejected-flags"
      className={cn(
        "rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200",
        className,
      )}
    >
      <span className="font-semibold">Ignored compiler flags: </span>
      {flags.map((f, i) => (
        <span key={f.flag} className="font-mono">
          {i > 0 ? ", " : ""}
          {f.flag}
          <span className="text-amber-200/60"> ({f.reason})</span>
        </span>
      ))}
    </div>
  );
}
