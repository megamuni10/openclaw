#!/usr/bin/env bash
set -euo pipefail

# Expose ONLY /googlechat publicly using:
# - tailscale serve (private dashboard on :8443, tailnet-only)
# - tailscale funnel (public /googlechat path only)
#
# Run on the VPS where the OpenClaw gateway is running.
#
# Preconditions:
# - `tailscale up` has been completed
# - OpenClaw gateway is reachable locally on http://127.0.0.1:18789
#   (default port; if you changed it, update GW_PORT below)

GW_PORT="${GW_PORT:-18789}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "ERROR: tailscale not installed." >&2
  exit 1
fi

echo "==> Serving private dashboard to tailnet only (https://<node>.<tailnet>.ts.net:8443)"
tailscale serve --bg --https=8443 "http://127.0.0.1:${GW_PORT}"

echo "==> Exposing ONLY /googlechat publicly (https://<node>.<tailnet>.ts.net/googlechat)"
tailscale funnel --bg --set-path=/googlechat "http://127.0.0.1:${GW_PORT}/googlechat"

echo
echo "==> Status"
tailscale serve status || true
tailscale funnel status || true

cat <<'EOF'

Next:
- Set your Google Chat app webhook URL to:
  https://<node>.<tailnet>.ts.net/googlechat

- Set OpenClaw config:
  channels.googlechat.audienceType = "app-url"
  channels.googlechat.audience     = "https://<node>.<tailnet>.ts.net/googlechat"

Security reminder:
- Do NOT expose the gateway root/dashboard publicly.
- Only /googlechat should be reachable from the internet.
EOF

