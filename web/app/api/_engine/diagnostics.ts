/**
 * web/app/api/_engine/diagnostics.ts
 *
 * Turn raw compiler stderr into structured diagnostics the UI can render as
 * gutter markers and a clickable problem list. Both GCC and clang emit the
 * same `file:line:col: severity: message` shape, which is all this parses.
 */

export type DiagnosticSeverity = "error" | "warning" | "note";

export type Diagnostic = {
  severity: DiagnosticSeverity;
  /** 1-based source line, or null when the diagnostic has no location. */
  line: number | null;
  /** 1-based column, or null when unknown. */
  column: number | null;
  message: string;
};

const LINE_RE =
  /^(?:(.+?):(\d+):(?:(\d+):)?\s+)?(fatal error|error|warning|note):\s+(.*)$/;

/**
 * Parse compiler output into diagnostics. Only lines that follow the
 * `path:line:col: severity: message` convention are picked up; everything
 * else (code excerpts, caret lines, "In function" context) is ignored.
 *
 * When `sourceName` is given, diagnostics that point at a different file (for
 * example the bundled `<bits/stdc++.h>` shim) keep their message but lose the
 * line number, so the editor never marks a line that is not in the user's
 * source.
 */
export function parseDiagnostics(
  stderr: string,
  sourceName = "main.cpp",
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const rawLine of stderr.split(/\r?\n/)) {
    const m = LINE_RE.exec(rawLine.trim());
    if (!m) continue;
    const [, file, lineStr, colStr, sev, message] = m;
    const inSource =
      !file ||
      file === sourceName ||
      file.endsWith(`/${sourceName}`) ||
      file.endsWith(`\\${sourceName}`);
    const line = inSource && lineStr ? Number(lineStr) : null;
    const column = inSource && colStr ? Number(colStr) : null;
    out.push({
      severity: sev === "fatal error" ? "error" : (sev as DiagnosticSeverity),
      line: Number.isFinite(line) ? line : null,
      column: Number.isFinite(column) ? column : null,
      message: message.trim(),
    });
  }
  return out;
}

/** Count errors and warnings in a diagnostics list. */
export function summarizeDiagnostics(diags: Diagnostic[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const d of diags) {
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
  }
  return { errors, warnings };
}
