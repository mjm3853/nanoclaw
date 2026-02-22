# NanoClaw (Personal Fork)

Fork of [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) — a personal Claude assistant that runs securely in containers. Single Node.js process connects to WhatsApp and routes messages to Claude Agent SDK running in isolated Linux containers.

## Setup

```bash
claude
```

Then run `/setup` inside Claude Code. It handles dependencies, WhatsApp authentication, container setup, and service configuration.

## Running

```bash
npm run dev          # Run with hot reload
npm run build        # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management (macOS):

```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

## What Runs Where

The **host process** (Node.js) runs directly on your laptop. It handles the WhatsApp connection, SQLite database, message polling, task scheduling, and IPC coordination. WhatsApp auth credentials live in `store/auth/` on the host and are never exposed to containers.

**Agent execution** happens inside Linux containers (Docker or Apple Container). When a message triggers the agent, the host spawns an isolated container, passes it the prompt via stdin, and reads the streamed result back. Each container only sees what's explicitly mounted — its own group folder, and optionally a read-only global folder. Containers cannot access the WhatsApp session, other groups' data, or the host filesystem beyond their mounts.

**Additional mount security** is enforced via an allowlist at `~/.config/nanoclaw/mount-allowlist.json` (stored outside the project, never mounted into containers). Sensitive paths like `.ssh`, `.aws`, `.env`, and private keys are blocked by default.

## Who Can Trigger the Agent

The **trust boundary is WhatsApp group membership**, not individual sender identity. Anyone in a registered group who uses the trigger word (default `@Andy`) can invoke the agent. There is no per-sender allowlist or rate limiting — if someone is in the group, they can trigger it.

Your **main channel** (self-chat) is the admin control plane. It processes messages without a trigger word and can manage all groups, schedule tasks for any group, and register new groups. Non-main groups are restricted to their own scope — they can only send IPC messages to their own chat and schedule tasks for themselves.

**What to watch for:** Unauthorized IPC attempts (cross-group operations from non-main groups) are logged. If you're concerned about who has access, the key control point is WhatsApp group membership itself — remove people from the group to revoke access. There's no separate audit log of per-sender activity beyond the standard message database.

## Requirements

- macOS or Linux
- Node.js 20+
- [Claude Code](https://claude.ai/download)
- [Apple Container](https://github.com/apple/container) (macOS) or [Docker](https://docker.com/products/docker-desktop) (macOS/Linux)

## License

MIT — see upstream repo for full details.
