# .swarm/ — Claude Swarm coordination directory

This directory is created and managed by **Claude Swarm**. It is the shared state
that lets multiple concurrent Claude Code sessions cooperate on one project
without stepping on each other.

- `board.json` — every task, its owned paths, deps, status, and assignee.
- `config.json` — the active swarm configuration.
- `tasks/<id>.md` — the full brief handed to the worker for each task.
- `status/<agentId>.json` — per-agent heartbeat + state (written by workers and by hooks).
- `handoffs/<agentId>.md` — what each worker did, for integrators and the next session.
- `agents/<agentId>.settings.json` — the --settings (hooks) injected into each worker.
- `bin/` — the hook + simulation + validation runner scripts.
- `events.jsonl` — append-only event log.

Safe to delete when no swarm is running. Add `.swarm/` to .gitignore.
