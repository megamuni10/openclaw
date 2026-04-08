#!/usr/bin/env bash
set -euo pipefail

# Native OpenClaw bootstrap for a Hetzner VPS (Ubuntu/Debian).
# - Creates dedicated user `openclaw`
# - Installs prerequisites
# - Installs Tailscale (you still must run `tailscale up`)
# - Installs OpenClaw using the official installer
# - Runs `openclaw onboard --install-daemon` as the `openclaw` user
#
# This script is intended to be copy/pasted onto the VPS and run as root:
#   sudo bash vps-bootstrap.sh

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERROR: run as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing base packages"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release

if ! id -u openclaw >/dev/null 2>&1; then
  echo "==> Creating user: openclaw"
  useradd --create-home --shell /bin/bash openclaw
fi

echo "==> Installing Tailscale (package repo)"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo
echo "==> IMPORTANT: authenticate Tailscale (required for Funnel/Serve):"
echo "    tailscale up"
echo

echo "==> Installing OpenClaw as user openclaw"
sudo -iu openclaw bash -lc 'curl -fsSL https://openclaw.ai/install.sh | bash'

echo
echo "==> Running OpenClaw onboarding (interactive)"
echo "    You will be prompted for provider + channel config."
echo
sudo -iu openclaw bash -lc 'openclaw onboard --install-daemon'

echo
echo "==> Next steps"
cat <<'EOF'
1) Copy config template into place (as openclaw user):
   - ~/.openclaw/openclaw.json  (from this repo: openclaw/config/openclaw.example.json5)

2) Put your Google Chat service account JSON on the VPS:
   - ~/.openclaw/googlechat-service-account.json

3) Put your OpenRouter key in:
   - ~/.openclaw/.env   (chmod 600)

4) Enable the Google Chat plugin and restart:
   openclaw plugins enable googlechat
   openclaw gateway restart
   openclaw channels status --probe

5) Set up Tailscale Serve + Funnel to expose only /googlechat:
   - run openclaw/scripts/tailscale-funnel-googlechat.sh

6) Security check:
   openclaw security audit --deep
EOF

