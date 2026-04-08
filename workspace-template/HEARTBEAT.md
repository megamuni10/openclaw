# HEARTBEAT.md

When you receive a heartbeat poll, do **one** small useful thing, then stop.
If nothing needs attention, reply `HEARTBEAT_OK`.

## Rotation (pick at most 1 per heartbeat)

- Check OpenClaw health quickly: `openclaw status` (only if you are in a trusted operator context)
- Summarize any new open loops from `memory/` into `MEMORY.md` (keep it short)
- If something broke recently, suggest the next debug command (no secrets)

## Quiet hours

- Default to quiet unless urgent.
