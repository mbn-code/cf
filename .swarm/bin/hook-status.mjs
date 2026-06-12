#!/usr/bin/env node
// Claude Code hook → writes/updates a worker status file the orchestrator polls.
// Invoked by the per-agent --settings hooks as:
//   node hook-status.mjs <agentId> <EventName> <statusPath>
// The hook event payload arrives as JSON on stdin.
import { readFileSync, writeFileSync } from "node:fs";

const [, , agentId, eventName, statusPath] = process.argv;

let payload = {};
try {
  const stdin = readFileSync(0, "utf8");
  if (stdin.trim()) payload = JSON.parse(stdin);
} catch {
  /* no/invalid stdin */
}

let cur = {};
try {
  cur = JSON.parse(readFileSync(statusPath, "utf8"));
} catch {
  /* first write */
}

// Terminal-good state set by the worker itself ("completed") is never downgraded.
const terminal = cur.state === "completed";
let state = cur.state || "started";
let ts = Date.now();
if (!terminal) {
  if (eventName === "SessionEnd") {
    state = "ended";
  } else if (eventName === "SessionStart") {
    state = cur.state || "started";
  } else if (eventName === "Stop") {
    // A stop attempt — likely blocked by the /goal gate and the worker keeps
    // going. NOT a completion signal, and it must NOT refresh the heartbeat
    // (only genuine tool use proves liveness), so a tool-free hang still goes
    // stale and gets reaped.
    state = cur.state || "started";
    ts = cur.ts || ts;
  } else {
    state = "working"; // PostToolUse / UserPromptSubmit → heartbeat
  }
}

const merged = {
  agentId,
  taskId: cur.taskId,
  state,
  phase: cur.phase,
  // Preserve a summary the worker set (e.g. via mark-done); only fall back to
  // the hook payload's reason (an end-reason code like "other") if none exists.
  summary: cur.summary || payload.reason,
  ts,
  hookEvent: eventName,
};

try {
  writeFileSync(statusPath, JSON.stringify(merged, null, 2));
} catch {
  /* best effort */
}
