#!/usr/bin/env node
// Runs a validation command in a tmux window and writes a ValidationResult JSON.
//   node run-validate.mjs <validatorId> <taskId> <kind> <cwd> <resultPath> <dry 0|1> <command...>
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const [, , validatorId, taskId, kind, cwd, resultPath, dry, ...cmdParts] =
  process.argv;
const command = cmdParts.join(" ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const C = {
  g: "\x1b[32m",
  r: "\x1b[31m",
  c: "\x1b[36m",
  d: "\x1b[2m",
  x: "\x1b[0m",
};
const result = (passed, summary, detail) => {
  try {
    writeFileSync(
      resultPath,
      JSON.stringify(
        { taskId, validatorId, kind, passed, summary, detail, at: Date.now() },
        null,
        2,
      ),
    );
  } catch {
    /* best effort */
  }
};

console.log(
  `${C.c}[VALIDATE] ${validatorId} task=${taskId} kind=${kind}${C.x}`,
);

if (dry === "1" || !command) {
  console.log(`${C.d}  (dry-run) simulating validation…${C.x}`);
  await sleep(2000);
  console.log(`${C.g}  ✓ simulated PASS${C.x}`);
  result(true, `(dry-run) ${kind} simulated PASS`);
  await sleep(500);
  process.exit(0);
}

// Build a PATH that resolves the common toolchains a validation command needs:
// the repo's own virtualenv (python/pytest), cargo, homebrew, then the inherited
// PATH. /bin/sh -c with a bare PATH is why `python`/`pytest` returned exit 127.
const HOME = process.env.HOME || "";
const PATH = [
  `${cwd}/.venv/bin`,
  `${cwd}/node_modules/.bin`,
  `${HOME}/.cargo/bin`,
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  process.env.PATH || "",
]
  .filter(Boolean)
  .join(":");
// If the repo has a venv, also export VIRTUAL_ENV so `python` resolves to it.
const env = { ...process.env, PATH };
if (typeof cwd === "string") env.VIRTUAL_ENV = `${cwd}/.venv`;

console.log(`${C.d}  $ ${command}\n  (cwd=${cwd})${C.x}`);
const child = spawn("/bin/sh", ["-c", command], {
  cwd,
  env,
  stdio: ["ignore", "inherit", "inherit"],
});
child.on("error", (e) => {
  console.log(`${C.r}  ✗ spawn error: ${e.message}${C.x}`);
  result(false, `${kind} error: ${e.message}`);
  setTimeout(() => process.exit(0), 600);
});
child.on("close", (code) => {
  const passed = code === 0;
  console.log(
    passed
      ? `${C.g}  ✓ PASS exit=0${C.x}`
      : `${C.r}  ✗ FAIL exit=${code}${C.x}`,
  );
  result(passed, `${kind} ${passed ? "passed" : "failed"} (exit ${code})`);
  setTimeout(() => process.exit(0), 600);
});
