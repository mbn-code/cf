/**
 * localStorage keys and defaults for workbench state that should survive a
 * reload (editor contents, settings, sample tests, stress sources, layout).
 * All access is guarded so it is safe to import during server rendering.
 */

import type { CheckerMode, RunSettings, TestCase } from "./api";

export const STORAGE_KEYS = {
  code: "cf:code",
  settings: "cf:settings",
  tests: "cf:tests",
  stress: "cf:stress",
  stdin: "cf:stdin",
  activeProblem: "cf:activeProblem",
  fontSize: "cf:fontSize",
  layout: "cf:layout",
  activeTab: "cf:activeTab",
} as const;

export const DEFAULT_SETTINGS: RunSettings = {
  std: "gnu++17",
  timeLimitMs: 5000,
  compilerFlags: [],
  checker: "lines",
  epsilon: 1e-6,
};

export const STD_OPTIONS = [
  "gnu++17",
  "gnu++20",
  "gnu++23",
  "c++17",
  "c++20",
  "c++23",
] as const;

export const CHECKER_OPTIONS: {
  id: CheckerMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "lines",
    label: "Lines",
    hint: "Exact lines; trailing whitespace ignored.",
  },
  {
    id: "tokens",
    label: "Tokens",
    hint: "Whitespace-insensitive token compare (Codeforces wcmp).",
  },
  {
    id: "float",
    label: "Float",
    hint: "Tokens, numbers within an absolute/relative epsilon.",
  },
];

export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;

export const MIN_TIME_LIMIT_MS = 100;
export const MAX_TIME_LIMIT_MS = 60000;

export const DEFAULT_STDIN = "2 3\n";
export const DEFAULT_TESTS: TestCase[] = [{ input: "2 3\n", expected: "5\n" }];

/** Editor / bottom-panel split as a fraction of the main column height. */
export const DEFAULT_LAYOUT = { panelFraction: 0.44 };
export const MIN_PANEL_FRACTION = 0.15;
export const MAX_PANEL_FRACTION = 0.85;

/** A sample test case carrying a stable id for React keys / row identity. */
export type SampleTest = { id: number; input: string; expected: string };

/** Strip UI-only ids before sending cases to the API or persisting a problem. */
export function toTestCases(tests: SampleTest[]): TestCase[] {
  return tests.map(({ input, expected }) => ({ input, expected }));
}

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / disabled — non-fatal, state simply will not persist.
  }
}

export function loadString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function saveString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // non-fatal
  }
}

export function clampTimeLimit(n: number): number {
  return Math.min(
    MAX_TIME_LIMIT_MS,
    Math.max(MIN_TIME_LIMIT_MS, Math.floor(n)),
  );
}

/** Coerce a possibly-partial persisted settings object into a valid one. */
export function normalizeSettings(value: unknown): RunSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const v = value as Record<string, unknown>;
  const std =
    typeof v.std === "string" && v.std.trim() ? v.std : DEFAULT_SETTINGS.std;
  const timeLimitMs =
    typeof v.timeLimitMs === "number" && Number.isFinite(v.timeLimitMs)
      ? clampTimeLimit(v.timeLimitMs)
      : DEFAULT_SETTINGS.timeLimitMs;
  const compilerFlags = Array.isArray(v.compilerFlags)
    ? v.compilerFlags.filter((f): f is string => typeof f === "string")
    : DEFAULT_SETTINGS.compilerFlags;
  const checker: CheckerMode =
    v.checker === "tokens" || v.checker === "float" || v.checker === "lines"
      ? v.checker
      : DEFAULT_SETTINGS.checker;
  const epsilon =
    typeof v.epsilon === "number" &&
    Number.isFinite(v.epsilon) &&
    v.epsilon >= 0
      ? Math.min(1, v.epsilon)
      : DEFAULT_SETTINGS.epsilon;
  return { std, timeLimitMs, compilerFlags, checker, epsilon };
}

/** Parse a whitespace-separated flags string into an argv array. */
export function parseFlags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Coerce a persisted layout object. */
export function normalizeLayout(value: unknown): { panelFraction: number } {
  if (!value || typeof value !== "object") return { ...DEFAULT_LAYOUT };
  const v = value as Record<string, unknown>;
  const f =
    typeof v.panelFraction === "number" && Number.isFinite(v.panelFraction)
      ? Math.min(
          MAX_PANEL_FRACTION,
          Math.max(MIN_PANEL_FRACTION, v.panelFraction),
        )
      : DEFAULT_LAYOUT.panelFraction;
  return { panelFraction: f };
}

/** Human-friendly "3 min ago" for the problems list. */
export function relativeTime(ts: number, now = Date.now()): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ts).toLocaleDateString();
}
