#!/usr/bin/env node
// A worker's reliable "I'm done" signal — one deterministic command instead of
// hand-writing JSON. Run from the project root as the FINAL step:
//   node .swarm/bin/mark-done.mjs <agentId> "<one-line summary>"
import { readFileSync, writeFileSync } from "node:fs";

const [, , agentId, ...rest] = process.argv;
const summary = rest.join(" ") || "task complete";
const path = `.swarm/status/${agentId}.json`;

let cur = {};
try {
  cur = JSON.parse(readFileSync(path, "utf8"));
} catch {
  /* first write */
}

writeFileSync(
  path,
  JSON.stringify(
    {
      agentId,
      taskId: cur.taskId,
      state: "completed",
      phase: "done",
      summary,
      ts: Date.now(),
    },
    null,
    2,
  ),
);
console.log(`✓ ${agentId} marked completed: ${summary}`);
