#!/usr/bin/env node
// Dry-run stand-in for a real `claude` worker. Exercises the ENTIRE coordination
// pipeline (heartbeat status files, board awareness, handoff, completion) without
// spawning a real session or touching any project files.
//   node sim-worker.mjs <agentId> <taskId> <statusPath> <handoffPath> <boardPath> <title...>
import { readFileSync, writeFileSync } from "node:fs";

const [, , agentId, taskId, statusPath, handoffPath, boardPath, ...rest] =
  process.argv;
const title = rest.join(" ") || taskId;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const jitter = 1 + (hash(taskId) % 5) * 0.18; // 1.0 .. 1.72 — desync finish times

const C = {
  g: "\x1b[32m",
  y: "\x1b[33m",
  c: "\x1b[36m",
  d: "\x1b[2m",
  x: "\x1b[0m",
};
const writeStatus = (state, phase, summary) => {
  try {
    writeFileSync(
      statusPath,
      JSON.stringify(
        { agentId, taskId, state, phase, summary, ts: Date.now() },
        null,
        2,
      ),
    );
  } catch {
    /* best effort */
  }
};

console.log(`${C.c}┌─ [SIM WORKER] ${agentId} → ${taskId}${C.x}`);
console.log(`${C.d}│ ${title}${C.x}`);

let board = {};
try {
  board = JSON.parse(readFileSync(boardPath, "utf8"));
} catch {
  /* board not ready yet */
}
const others = (board.tasks || []).filter(
  (t) =>
    t.id !== taskId &&
    ["in_progress", "claimed", "validating"].includes(t.status),
);
console.log(
  `${C.d}│ siblings active: ${others.map((t) => `${t.id}:${t.area}`).join(", ") || "none"}${C.x}`,
);

const phases = [
  ["orienting", "reading CLAUDE.md + MEMORY + handoff"],
  ["planning", "sequencing the task within owned paths"],
  ["implementing", "editing owned files"],
  ["implementing", "more edits + wiring"],
  ["self-check", "clippy/fmt/tests"],
  ["handoff", "writing handoff note"],
];

writeStatus("started", "spawned", "sim worker up");
await sleep(600);
for (let i = 0; i < phases.length; i++) {
  const [phase, desc] = phases[i];
  writeStatus("working", phase, desc);
  console.log(`${C.y}│ [${i + 1}/${phases.length}] ${phase}${C.x} — ${desc}`);
  await sleep(Math.round((1400 + (hash(taskId + phase) % 1600)) * jitter));
}

const handoff = `# Handoff — ${taskId} (${agentId})

_(dry-run simulation — no real files were modified)_

## Task
${title}

## What changed
Simulated edits confined to this task's owned paths.

## How to verify
Dry-run: validation is simulated PASS.

## Follow-ups
None (simulation).
`;
try {
  writeFileSync(handoffPath, handoff);
} catch {
  /* best effort */
}

writeStatus("completed", "done", "simulated task complete");
console.log(
  `${C.g}└─ DONE ${taskId} ✓ (handoff written, status=completed)${C.x}`,
);
await sleep(900);
process.exit(0);
