# Custom OpenClaw skills (Muni Health)

OpenClaw skills are **AgentSkills-compatible** skill folders: each skill lives in its own directory containing a `SKILL.md` with YAML frontmatter + instructions.

## Where OpenClaw loads skills from (docs)

Precedence (highest → lowest):

1. `<workspace>/skills`
2. `~/.openclaw/skills`
3. bundled skills

You can also add extra skill dirs with `skills.load.extraDirs` in `~/.openclaw/openclaw.json` (lowest precedence).

## Recommended workflow for this repo

- Keep your canonical skill source in-repo under `openclaw/skills/`.
- On the VPS, clone/copy this repo (or just the `openclaw/` folder) to a stable path (example: `~/munihealth/openclaw/`).
- In `~/.openclaw/openclaw.json`, point `skills.load.extraDirs` at that folder (see `openclaw/config/openclaw.example.json5`).

## Security notes

- Treat skills as **trusted code**. Anything with `exec`/`browser` can be high blast-radius under prompt injection.
- Keep secrets out of skill text. Use environment variables and OpenClaw’s redaction (`logging.redactSensitive: "tools"`).
- If you enable sandboxing later, remember binaries must exist **inside** the sandbox container for sandboxed runs.
