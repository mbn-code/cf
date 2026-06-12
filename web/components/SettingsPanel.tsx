"use client";

import type { ReactNode } from "react";
import type { RunSettings } from "@/lib/api";
import {
  STD_OPTIONS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  parseFlags,
} from "@/lib/storage";

/**
 * Settings panel: language standard, time limit, extra compiler flags and
 * editor font size. Values feed straight into every /api/run, /api/test and
 * /api/stress request.
 */
export function SettingsPanel({
  settings,
  onSettingsChange,
  fontSize,
  onFontSizeChange,
}: {
  settings: RunSettings;
  onSettingsChange: (settings: RunSettings) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}) {
  return (
    <div
      className="h-full space-y-5 overflow-y-auto p-4"
      data-testid="settings-panel"
    >
      <Row
        label="Language standard"
        hint="Passed as -std=<value> to the compiler."
      >
        <select
          value={settings.std}
          onChange={(e) =>
            onSettingsChange({ ...settings, std: e.target.value })
          }
          data-testid="settings-std"
          aria-label="Language standard"
          className="w-44 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600"
        >
          {STD_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Time limit (ms)" hint="Wall-clock cap per execution.">
        <input
          type="number"
          min={100}
          max={60000}
          step={100}
          value={settings.timeLimitMs}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              timeLimitMs: clampTimeLimit(e.target.value, settings.timeLimitMs),
            })
          }
          data-testid="settings-time-limit"
          aria-label="Time limit in milliseconds"
          className="w-44 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-center font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
        />
      </Row>

      <Row
        label="Extra compiler flags"
        hint="Space-separated, appended after -O2 (e.g. -Wall -DLOCAL)."
      >
        <input
          type="text"
          value={settings.compilerFlags.join(" ")}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              compilerFlags: parseFlags(e.target.value),
            })
          }
          data-testid="settings-flags"
          aria-label="Extra compiler flags"
          placeholder="-Wall -Wextra"
          className="w-64 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600"
        />
      </Row>

      <Row
        label="Editor font size"
        hint={`${MIN_FONT_SIZE}–${MAX_FONT_SIZE}px`}
      >
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            data-testid="settings-font-size"
            aria-label="Editor font size"
            className="w-40 accent-zinc-400"
          />
          <span className="w-10 text-right font-mono text-xs text-zinc-300">
            {fontSize}px
          </span>
        </div>
      </Row>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-200">{label}</span>
        <span className="text-[10px] text-zinc-600">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function clampTimeLimit(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(60000, Math.max(100, n));
}
