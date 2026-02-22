# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Context

Fork of [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw). Single Node.js process connects to WhatsApp, routes messages to Claude Agent SDK running in isolated Linux containers. Each WhatsApp group gets its own container with isolated filesystem and persistent memory via `groups/{name}/CLAUDE.md`.

## Development

```bash
npm run dev          # Run with hot reload (tsx)
npm run build        # Compile TypeScript to dist/
npm test             # Vitest test suite
npm run format       # Prettier
./container/build.sh # Rebuild agent container image
```

Service management (macOS launchd):

```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

Run commands directly — don't tell the user to run them.

## Architecture

**Message flow:** WhatsApp (baileys) → SQLite → polling loop (2s) → GroupQueue → container spawn → Claude Agent SDK → streamed result → WhatsApp reply.

**Concurrency model:** `GroupQueue` enforces a global limit of 5 concurrent containers with per-group state tracking, exponential backoff retries, and idle timeouts (30min).

**Container I/O protocol:** Host sends JSON config via stdin. Agent streams results to stdout between `---NANOCLAW_OUTPUT_START---` / `---NANOCLAW_OUTPUT_END---` markers. Follow-up messages arrive via IPC file polling at `/workspace/ipc/input/*.json`; a `_close` sentinel signals end.

**IPC system:** File-based, polled every 1s by host. Containers write JSON files to `/workspace/ipc/{messages|tasks}/` for `send_message` and `schedule_task` operations. Host validates authorization (main group can target any group; others restricted to own chatJid), executes, then deletes the file.

**Three-tier memory:** Global (`groups/CLAUDE.md`, read by all groups), per-group (`groups/{name}/CLAUDE.md`, isolated), and session-level (`data/sessions/{group}/.claude/`). Transcripts archived to `conversations/` before SDK compaction.

**Mount security:** Additional mounts validated against an allowlist at `~/.config/nanoclaw/mount-allowlist.json` (stored outside project, never mounted into containers). Default blocked patterns include `.ssh`, `.aws`, credentials, `.env`, private keys.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: loads state, starts all subsystems, message loop |
| `src/channels/whatsapp.ts` | WhatsApp connection via baileys, message send/receive |
| `src/container-runner.ts` | Spawns containers, builds volume mounts, parses streamed output |
| `src/group-queue.ts` | Per-group queue with concurrency limits and retry logic |
| `src/ipc.ts` | File-based IPC polling, authorization, task/message dispatch |
| `src/db.ts` | SQLite schema, migrations, all DB operations |
| `src/task-scheduler.ts` | Cron/interval/once task runner (polls every 60s) |
| `src/router.ts` | XML message formatting and outbound channel routing |
| `src/mount-security.ts` | Mount allowlist validation and blocked pattern enforcement |
| `src/config.ts` | Constants: trigger pattern, paths, intervals, timeouts |
| `container/agent-runner/src/index.ts` | In-container agent: reads stdin config, runs Claude SDK, streams results |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | MCP server providing send_message and schedule_task tools inside containers |

## Skills

| Skill | Purpose |
|-------|---------|
| `/setup` | First-time installation, WhatsApp auth, container setup |
| `/customize` | Add channels, integrations, modify behavior |
| `/debug` | Container issues, logs, troubleshooting |

## Container Build Cache

The container buildkit caches aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder first, then re-run `./container/build.sh`.

## Database

SQLite at `data/messages.db`. Key tables: `messages` (chat history), `chats` (group metadata), `scheduled_tasks` (cron/interval/once jobs with next_run tracking), `registered_groups` (active groups with trigger patterns and container config as JSON), `sessions` (group → session ID mapping).

## Environment

Secrets live in `.env` and are read via `readEnvFile()` in `src/env.ts` — they are intentionally **not** loaded into `process.env` to prevent leaking to child processes. Key vars: `ASSISTANT_NAME` (trigger word, default "Andy"), `ASSISTANT_HAS_OWN_NUMBER`.
