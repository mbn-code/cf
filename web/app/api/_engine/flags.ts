/**
 * web/app/api/_engine/flags.ts
 *
 * Validation for user-supplied compiler flags and language standards.
 *
 * The workbench is a local tool, but every /api/* route accepts flags straight
 * from the browser. A flag such as `-o /some/path`, `-include /etc/passwd`,
 * `@response-file` or `-fplugin=` turns the compiler into a file writer or a
 * code loader, so only the flag families a competitive programmer actually
 * needs are let through. Anything else is reported back as rejected so the UI
 * can explain why a setting was ignored instead of silently dropping it.
 */

/** Flag prefixes that are safe to forward verbatim. */
const ALLOWED_PREFIXES = [
  "-O", // optimisation level
  "-W", // warnings (incl. -Werror, -Wno-*)
  "-w", // silence warnings
  "-D", // macro definitions
  "-U", // macro undefinitions
  "-f", // codegen / sanitizer switches (-fsanitize=..., -fno-omit-frame-pointer)
  "-g", // debug info
  "-m", // machine flags (-march=native, -m64)
  "-std=", // language standard
  "-pedantic",
  "-static",
  "-pthread",
  "-pipe",
  "-ansi",
  "-trigraphs",
];

/** Flags that are dangerous even though they share an allowed prefix. */
const DENIED_PREFIXES = [
  "-fplugin", // loads arbitrary shared objects into the compiler
  "-fpass-plugin",
  "-fuse-ld",
  "-fprofile", // writes files outside the work dir
  "-fdump",
  "-fsave",
  "-frandom-seed",
  "-fmodule",
  "-fpch",
  "-fdebug-prefix-map",
  "-ffile-prefix-map",
  "-Wl,", // linker pass-through
  "-Wa,", // assembler pass-through
  "-Wp,", // preprocessor pass-through
];

/** Only the standards the toolchains actually understand. */
const STD_PATTERN = /^(gnu|c)\+\+(0x|11|14|17|1z|2a|20|2b|23|2c|26)$/;

export type FlagValidation = {
  /** Flags that passed validation, in their original order. */
  accepted: string[];
  /** Flags that were dropped, each paired with a short reason. */
  rejected: { flag: string; reason: string }[];
};

/** Split a raw flags string into argv-style tokens (whitespace separated). */
export function tokenizeFlags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Filter a list of compiler flags down to the safe subset.
 * Never throws; unknown input types are treated as an empty list.
 */
export function validateFlags(input: unknown): FlagValidation {
  const list: string[] = Array.isArray(input)
    ? input.filter((f): f is string => typeof f === "string")
    : typeof input === "string"
      ? tokenizeFlags(input)
      : [];

  const accepted: string[] = [];
  const rejected: { flag: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const raw of list) {
    const flag = raw.trim();
    if (!flag) continue;
    if (seen.has(flag)) continue;
    seen.add(flag);

    if (flag.length > 128) {
      rejected.push({ flag, reason: "flag is too long" });
      continue;
    }
    if (!flag.startsWith("-")) {
      rejected.push({ flag, reason: "not a flag (must start with '-')" });
      continue;
    }
    if (/[\s"'`$\\;|&<>]/.test(flag)) {
      rejected.push({ flag, reason: "contains shell metacharacters" });
      continue;
    }
    if (flag === "-std" || flag.startsWith("-std=")) {
      const std = flag.slice("-std=".length);
      if (!STD_PATTERN.test(std)) {
        rejected.push({ flag, reason: "unsupported language standard" });
        continue;
      }
    }
    if (DENIED_PREFIXES.some((p) => flag.startsWith(p))) {
      rejected.push({ flag, reason: "flag family is not allowed" });
      continue;
    }
    if (!ALLOWED_PREFIXES.some((p) => flag === p || flag.startsWith(p))) {
      rejected.push({ flag, reason: "flag family is not allowed" });
      continue;
    }
    accepted.push(flag);
  }

  return { accepted, rejected };
}

/**
 * Validate a `std` value coming from a request. Returns the value when it is a
 * known standard, otherwise `fallback`.
 */
export function validateStd(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const std = value.trim();
  return STD_PATTERN.test(std) ? std : fallback;
}
