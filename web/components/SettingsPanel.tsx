"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  clearServerCache,
  type RunSettings,
  type WorkbenchConfig,
} from "@/lib/api";
import {
  STD_OPTIONS,
  CHECKER_OPTIONS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_TIME_LIMIT_MS,
  MAX_TIME_LIMIT_MS,
  DEFAULT_SETTINGS,
  parseFlags,
  clampTimeLimit,
} from "@/lib/storage";

/**
 * Settings panel: language standard, time limit, checker mode, extra
 * compiler flags and editor font size. Values feed straight into every
 * /api/run, /api/test and /api/stress request. A read-only "server" section
 * shows the detected toolchain and lets you drop the compile cache.
 */
export function SettingsPanel({
  settings,
  onSettingsChange,
  fontSize,
  onFontSizeChange,
  config,
}: {
  settings: RunSettings;
  onSettingsChange: (settings: RunSettings) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  config: WorkbenchConfig | null;
}) {
  const [flagsText, setFlagsText] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const flagsValue = flagsText ?? settings.compilerFlags.join(" ");

  const clearCache = async () => {
    setClearing(true);
    try {
      const n = await clearServerCache();
      toast.success(`Cleared ${n} cached binar${n === 1 ? "y" : "ies"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear cache");
    } finally {
      setClearing(false);
    }
  };

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
          className={selectClass}
        >
          {STD_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Row>

      <Row
        label="Time limit (ms)"
        hint={`Wall-clock cap per execution (${MIN_TIME_LIMIT_MS}–${MAX_TIME_LIMIT_MS}).`}
      >
        <input
          type="number"
          min={MIN_TIME_LIMIT_MS}
          max={MAX_TIME_LIMIT_MS}
          step={100}
          value={settings.timeLimitMs}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              timeLimitMs: readNumber(e.target.value, settings.timeLimitMs),
            })
          }
          data-testid="settings-time-limit"
          aria-label="Time limit in milliseconds"
          className={cn(inputClass, "w-44 text-center")}
        />
      </Row>

      <Row label="Output checker" hint="How Tests and Stress compare outputs.">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settings.checker}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                checker: e.target.value as RunSettings["checker"],
              })
            }
            data-testid="settings-checker"
            aria-label="Output checker"
            className={selectClass}
          >
            {CHECKER_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {settings.checker === "float" ? (
            <label className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="font-bold uppercase tracking-widest text-zinc-500">
                eps
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={String(settings.epsilon)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0)
                    onSettingsChange({ ...settings, epsilon: Math.min(1, n) });
                }}
                data-testid="settings-epsilon"
                aria-label="Float checker epsilon"
                className={cn(inputClass, "w-24 text-center")}
              />
            </label>
          ) : null}
          <span className="text-[10px] text-zinc-600">
            {CHECKER_OPTIONS.find((c) => c.id === settings.checker)?.hint}
          </span>
        </div>
      </Row>

      <Row
        label="Extra compiler flags"
        hint="Space-separated, appended after -O2. Only -O/-W/-D/-f/-g/-m/-std families are accepted."
      >
        <input
          type="text"
          value={flagsValue}
          onChange={(e) => {
            setFlagsText(e.target.value);
            onSettingsChange({
              ...settings,
              compilerFlags: parseFlags(e.target.value),
            });
          }}
          onBlur={() => setFlagsText(null)}
          data-testid="settings-flags"
          aria-label="Extra compiler flags"
          placeholder="-Wall -Wextra -DLOCAL -fsanitize=address,undefined"
          className={cn(inputClass, "w-full max-w-md")}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={() => {
            setFlagsText(null);
            onSettingsChange({ ...DEFAULT_SETTINGS });
            toast.success("Settings reset to defaults");
          }}
          data-testid="settings-reset"
          className={buttonClass}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={clearCache}
          disabled={clearing}
          data-testid="settings-clear-cache"
          className={buttonClass}
        >
          {clearing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Clear compile cache
        </button>
      </div>

      <div
        className="space-y-1 border-t border-zinc-800 pt-4 font-mono text-[11px] text-zinc-500"
        data-testid="settings-server-info"
      >
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Server
        </div>
        {config ? (
          <>
            <Info label="workbench" value={`v${config.version}`} />
            <Info
              label="compiler"
              value={config.compilerVersion ?? "not found"}
              tone={config.compilerVersion ? undefined : "error"}
            />
            <Info label="platform" value={config.platform} />
            <Info label="include" value={config.includeDir} />
            <Info
              label="limits"
              value={`source ${fmtKb(config.limits.maxSourceBytes)}, stdin ${fmtKb(config.limits.maxInputBytes)}, output ${fmtKb(config.limits.maxOutputBytes)}, compile ${config.limits.compileTimeoutMs / 1000}s`}
            />
            <Info label="cache" value={`${config.cache.entries} binaries`} />
          </>
        ) : (
          <div className="text-zinc-600">Server info unavailable.</div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-600";
const selectClass =
  "w-44 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600";
const buttonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

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
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-xs font-semibold text-zinc-200">{label}</span>
        <span className="text-[10px] text-zinc-600">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function Info({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "error";
}) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-zinc-600">{label}</span>
      <span
        className={cn(
          "break-all",
          tone === "error" ? "text-red-400" : "text-zinc-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function fmtKb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / 1024 / 1024)} MiB`
    : `${Math.round(bytes / 1024)} KiB`;
}

function readNumber(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return clampTimeLimit(n);
}
