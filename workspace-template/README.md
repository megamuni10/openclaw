# MegaMuni workspace template

OpenClaw’s docs treat the **workspace** as the assistant’s durable “mind”:

- **Workspace (per agent)**: `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/YYYY-MM-DD.md`, optional `HEARTBEAT.md`.
- **State dir (`~/.openclaw`)**: config, credentials, auth profiles, sessions, logs, and shared skills.

This folder is a **template** you copy into your VPS workspace directory (configured by `agents.defaults.workspace`).

## How to use on the VPS

Assuming the workspace is set to `~/.openclaw/workspace/muni-health`:

1. Create the workspace folder (as the `openclaw` user):

```bash
mkdir -p ~/.openclaw/workspace/muni-health
```

2. Copy the contents of this template into it.

3. Restart the gateway:

```bash
openclaw gateway restart
```

## What to edit first

- `IDENTITY.md`: name + vibe (already set to **MegaMuni**).
- `USER.md`: your details (founder context, timezone).
- `MEMORY.md`: durable business context + your preferences (no secrets; avoid PHI).
- `TOOLS.md`: environment specifics (tailnet URLs, hosts).
