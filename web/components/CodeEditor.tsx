"use client";

import { useEffect, useMemo, useRef } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";

/**
 * C++ source editor: Prism syntax highlighting, a synced line-number gutter,
 * tab-key handling (4-space soft tabs), and an adjustable font size. The actual
 * <textarea> carries a stable id/data-testid/aria-label so e2e tests can type
 * into it directly (e.g. `#code-editor`).
 */
export function CodeEditor({
  value,
  onChange,
  fontSize,
  minLines = 24,
  testId = "code-editor",
  ariaLabel = "C++ source code editor",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  fontSize: number;
  minLines?: number;
  testId?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lineHeight = Math.round(fontSize * 1.6);
  const padding = 14;

  const lineCount = useMemo(() => {
    const n = value.length === 0 ? 1 : value.split("\n").length;
    return Math.max(minLines, n);
  }, [value, minLines]);

  // The library spreads unknown props onto its container <div>, not the inner
  // <textarea>. Stamp the test hooks onto the textarea itself after mount.
  useEffect(() => {
    const textarea = wrapperRef.current?.querySelector("textarea");
    if (textarea) {
      textarea.setAttribute("data-testid", testId);
      textarea.setAttribute("aria-label", ariaLabel);
      textarea.setAttribute("spellcheck", "false");
      textarea.setAttribute("autocapitalize", "off");
      textarea.setAttribute("autocorrect", "off");
    }
  }, [testId, ariaLabel]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative h-full w-full overflow-auto bg-[#1e1e1e]",
        className,
      )}
    >
      <div className="flex min-h-full w-max min-w-full">
        <div
          aria-hidden="true"
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
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ height: lineHeight }}>
              {i + 1}
            </div>
          ))}
        </div>

        <div className="flex-1">
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
