"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";

export type LineMarker = "error" | "warning";

/** Map of 1-based line number → marker severity, drawn in the gutter. */
export type LineMarkers = Record<number, LineMarker>;

export type CursorPosition = { line: number; column: number };

/**
 * C++ source editor: Prism syntax highlighting, a synced line-number gutter
 * with error/warning markers, tab-key handling (4-space soft tabs), Ctrl+/
 * line-comment toggling, cursor tracking, and an adjustable font size. The
 * actual <textarea> carries a stable id/data-testid/aria-label so e2e tests
 * can type into it directly (e.g. `#code-editor`).
 */
export function CodeEditor({
  value,
  onChange,
  fontSize,
  minLines = 24,
  testId = "code-editor",
  ariaLabel = "C++ source code editor",
  markers,
  onCursorChange,
  gotoLine,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  fontSize: number;
  minLines?: number;
  testId?: string;
  ariaLabel?: string;
  markers?: LineMarkers;
  onCursorChange?: (pos: CursorPosition) => void;
  /** Bump this (e.g. `{ line, nonce }`) to move the caret to a line. */
  gotoLine?: { line: number; nonce: number } | null;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lineHeight = Math.round(fontSize * 1.6);
  const padding = 14;

  const lineCount = useMemo(() => {
    const n = value.length === 0 ? 1 : value.split("\n").length;
    return Math.max(minLines, n);
  }, [value, minLines]);

  const textarea = useCallback(
    () => wrapperRef.current?.querySelector("textarea") ?? null,
    [],
  );

  // The library spreads unknown props onto its container <div>, not the inner
  // <textarea>. Stamp the test hooks onto the textarea itself after mount.
  useEffect(() => {
    const ta = textarea();
    if (ta) {
      ta.setAttribute("data-testid", testId);
      ta.setAttribute("aria-label", ariaLabel);
      ta.setAttribute("spellcheck", "false");
      ta.setAttribute("autocapitalize", "off");
      ta.setAttribute("autocorrect", "off");
    }
  }, [testId, ariaLabel, textarea]);

  const reportCursor = useCallback(() => {
    if (!onCursorChange) return;
    const ta = textarea();
    if (!ta) return;
    const upto = ta.value.slice(0, ta.selectionStart);
    const line = upto.split("\n").length;
    const column = upto.length - upto.lastIndexOf("\n");
    onCursorChange({ line, column });
  }, [onCursorChange, textarea]);

  useEffect(() => {
    const ta = textarea();
    if (!ta || !onCursorChange) return;
    const handler = () => reportCursor();
    ta.addEventListener("keyup", handler);
    ta.addEventListener("click", handler);
    ta.addEventListener("select", handler);
    return () => {
      ta.removeEventListener("keyup", handler);
      ta.removeEventListener("click", handler);
      ta.removeEventListener("select", handler);
    };
  }, [onCursorChange, reportCursor, textarea]);

  // Jump to a requested line (from a diagnostic click) and scroll it into view.
  useEffect(() => {
    if (!gotoLine) return;
    const ta = textarea();
    if (!ta) return;
    const lines = ta.value.split("\n");
    const target = Math.min(Math.max(1, gotoLine.line), lines.length);
    let offset = 0;
    for (let i = 0; i < target - 1; i++) offset += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(offset, offset + lines[target - 1].length);
    const container = wrapperRef.current;
    if (container) {
      const y = padding + (target - 1) * lineHeight;
      container.scrollTo({
        top: Math.max(0, y - container.clientHeight / 2),
        behavior: "smooth",
      });
    }
    reportCursor();
  }, [gotoLine, lineHeight, reportCursor, textarea]);

  // Ctrl+/ toggles `// ` on every selected line.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== "/") return;
    const ta = textarea();
    if (!ta) return;
    e.preventDefault();
    const { selectionStart, selectionEnd } = ta;
    const text = ta.value;
    const startLine = text.lastIndexOf("\n", selectionStart - 1) + 1;
    let endLine = text.indexOf("\n", selectionEnd);
    if (endLine === -1) endLine = text.length;
    const block = text.slice(startLine, endLine);
    const lines = block.split("\n");
    const allCommented = lines.every(
      (l) => l.trim() === "" || /^\s*\/\/ ?/.test(l),
    );
    const toggled = lines
      .map((l) =>
        allCommented
          ? l.replace(/^(\s*)\/\/ ?/, "$1")
          : l.trim() === ""
            ? l
            : l.replace(/^(\s*)/, "$1// "),
      )
      .join("\n");
    const next = text.slice(0, startLine) + toggled + text.slice(endLine);
    onChange(next);
    const delta = toggled.length - block.length;
    requestAnimationFrame(() => {
      ta.setSelectionRange(startLine, endLine + delta);
    });
  };

  return (
    <div
      ref={wrapperRef}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-full w-full overflow-auto bg-[#1e1e1e]",
        className,
      )}
    >
      <div className="flex min-h-full w-max min-w-full">
        <div
          aria-hidden="true"
          data-testid={`${testId}-gutter`}
          className="shrink-0 select-none border-r border-zinc-800/60 bg-[#1a1a1a] text-right font-mono text-zinc-600"
          style={{
            paddingTop: padding,
            paddingBottom: padding,
            paddingLeft: 10,
            paddingRight: 10,
            fontSize: fontSize - 1,
            lineHeight: `${lineHeight}px`,
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => {
            const marker = markers?.[i + 1];
            return (
              <div
                key={i}
                data-marker={marker}
                style={{ height: lineHeight }}
                className={cn(
                  "relative pl-3",
                  marker === "error" && "text-red-400",
                  marker === "warning" && "text-amber-400",
                )}
              >
                {marker ? (
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full",
                      marker === "error" ? "bg-red-500" : "bg-amber-400",
                    )}
                  />
                ) : null}
                {i + 1}
              </div>
            );
          })}
        </div>

        <div className="relative flex-1">
          {markers ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ paddingTop: padding }}
            >
              {Object.entries(markers).map(([ln, sev]) => (
                <div
                  key={ln}
                  className={cn(
                    "absolute left-0 right-0",
                    sev === "error" ? "bg-red-500/10" : "bg-amber-400/10",
                  )}
                  style={{
                    top: padding + (Number(ln) - 1) * lineHeight,
                    height: lineHeight,
                  }}
                />
              ))}
            </div>
          ) : null}
          <Editor
            value={value}
            onValueChange={onChange}
            highlight={(code) =>
              Prism.highlight(code, Prism.languages.cpp, "cpp")
            }
            padding={padding}
            tabSize={4}
            insertSpaces
            textareaId={testId}
            textareaClassName="cf-code-textarea focus:outline-none"
            className="cf-code-editor"
            style={{
              fontFamily:
                'var(--font-geist-mono), "Fira Code", "Fira Mono", monospace',
              fontSize,
              lineHeight: `${lineHeight}px`,
              minHeight: "100%",
              backgroundColor: "transparent",
              color: "#d4d4d4",
            }}
          />
        </div>
      </div>
    </div>
  );
}
