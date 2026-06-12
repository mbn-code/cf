/**
 * localStorage keys and defaults for workbench state that should survive a
 * reload (editor contents, settings, sample tests, stress sources). All access
 * is guarded so it is safe to import during server rendering.
 */

import type { RunSettings, TestCase } from "./api";

export const STORAGE_KEYS = {
  code: "cf:code",
  settings: "cf:settings",
  tests: "cf:tests",
  stress: "cf:stress",
  activeProblem: "cf:activeProblem",
  fontSize: "cf:fontSize",
} as const;

export const DEFAULT_SETTINGS: RunSettings = {
  std: "gnu++17",
  timeLimitMs: 5000,
  compilerFlags: [],
};

export const STD_OPTIONS = [
  "gnu++17",
  "gnu++20",
  "gnu++23",
  "c++17",
  "c++20",
] as const;

export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;

export const DEFAULT_TESTS: TestCase[] = [{ input: "2 3\n", expected: "5\n" }];

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

/** Coerce a possibly-partial persisted settings object into a valid one. */
export function normalizeSettings(value: unknown): RunSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const v = value as Record<string, unknown>;
  const std =
    typeof v.std === "string" && v.std.trim() ? v.std : DEFAULT_SETTINGS.std;
  const timeLimitMs =
    typeof v.timeLimitMs === "number" && Number.isFinite(v.timeLimitMs)
      ? Math.min(60000, Math.max(100, Math.floor(v.timeLimitMs)))
      : DEFAULT_SETTINGS.timeLimitMs;
  const compilerFlags = Array.isArray(v.compilerFlags)
    ? v.compilerFlags.filter((f): f is string => typeof f === "string")
    : DEFAULT_SETTINGS.compilerFlags;
  return { std, timeLimitMs, compilerFlags };
}

/** Parse a whitespace-separated flags string into an argv array. */
export function parseFlags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
