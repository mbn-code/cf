"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Scrollable raw terminal log. Keeps the existing always-scrollable behavior
 * (vertical scroll, wrapped long lines) and auto-sticks to the bottom when new
 * output arrives unless the user has scrolled up to read earlier output.
 */
export function Terminal({
  text,
  placeholder = "Waiting for execution…",
  testId = "terminal-output",
  ariaLabel = "Program output",
  className,
}: {
  text: string;
  placeholder?: string;
  testId?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const stickRef = useRef(true);

  // Track whether we are pinned to the bottom so streaming output keeps the
  // tail visible without yanking the viewport while the user scrolls back.
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useEffect(() => {
    const el = ref.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <pre
      ref={ref}
      onScroll={onScroll}
      data-testid={testId}
      aria-label={ariaLabel}
      role="log"
      aria-live="polite"
      className={cn(
        "h-full w-full overflow-y-auto whitespace-pre-wrap break-words bg-zinc-950 p-4 font-mono text-[12px] leading-relaxed text-zinc-300 selection:bg-zinc-700",
        className,
      )}
    >
      {text ? text : <span className="text-zinc-600">{placeholder}</span>}
    </pre>
  );
}
