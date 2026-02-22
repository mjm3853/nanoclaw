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

## Requirements

- macOS or Linux
- Node.js 20+
- [Claude Code](https://claude.ai/download)
- [Apple Container](https://github.com/apple/container) (macOS) or [Docker](https://docker.com/products/docker-desktop) (macOS/Linux)

## License

MIT — see upstream repo for full details.
