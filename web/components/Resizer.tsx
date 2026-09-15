"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal drag handle between the editor and the bottom panel. Reports the
 * pointer's vertical position as a fraction of the container's height so the
 * parent can size the panel; double-click restores the default.
 */
export function Resizer({
  containerRef,
  onResize,
  onReset,
  className,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onResize: (panelFraction: number) => void;
  onReset?: () => void;
  className?: string;
}) {
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) return;
      const fromBottom = rect.bottom - e.clientY;
      onResize(fromBottom / rect.height);
    },
    [containerRef, onResize],
  );

  const end = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be gone
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize panel"
      data-testid="panel-resizer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      className={cn(
        "group relative z-10 h-1.5 shrink-0 cursor-row-resize bg-zinc-800 transition hover:bg-zinc-600",
        className,
      )}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-600 group-hover:bg-zinc-400" />
    </div>
  );
}
