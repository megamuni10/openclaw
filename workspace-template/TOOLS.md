# TOOLS.md — Environment notes (VPS)

This file is for setup-specific details that shouldn’t live inside shared skills.

## Gateway (Hetzner VPS)

- Hostname/IP: (fill in)
- OS: Ubuntu/Debian
- OpenClaw user: `openclaw`
- Gateway port (default): `18789`

## Tailscale

- Tailnet: (fill in)
- Private dashboard (Serve): `https://<node>.<tailnet>.ts.net:8443/`
- Public Google Chat webhook (Funnel): `https://<node>.<tailnet>.ts.net/googlechat`

## Google Chat

- GCP project number: (optional)
- Service account JSON path: `~/.openclaw/googlechat-service-account.json`
- Pairing policy: `pairing` (DMs)

## Models (OpenRouter)

- Primary: `openrouter/moonshotai/kimi-k2.5`
- Fallback: `openrouter/anthropic/claude-opus-4.5`
