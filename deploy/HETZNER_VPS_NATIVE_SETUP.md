# Hetzner VPS → OpenClaw (Native) Setup Guide

This guide takes you from **creating a Hetzner VPS** to a working OpenClaw Gateway configured for:

- **Google Chat** (webhook-only; public HTTPS required)
- **Tailscale Serve + Funnel** (private dashboard, public `/googlechat` only)
- **OpenRouter models** (Kimi K2.5 primary, Opus 4.5 fallback)
- **Browser running on the VPS** (OpenClaw-managed, headless)

No secrets are committed to git. Keep keys in `~/.openclaw/.env` on the VPS.

## What you’ll need

- A Hetzner VPS (Ubuntu or Debian)
- A Tailscale account + tailnet you control
- An OpenRouter API key
- Google Cloud project access (for Google Chat app + service account JSON key)

### Recommended VPS sizing (practical)

OpenClaw can run small, but browser automation is RAM-hungry.

- **Recommended**: 1–2 vCPU, **2GB RAM+**
- Disk: 20GB+ is usually fine (logs + workspace + browser profile data)

### Step 1: Provision the Hetzner VPS (settings)

In Hetzner Cloud, create a new server with:

- **Image**: Ubuntu LTS (or Debian)
- **Type**: pick something with **2GB RAM+** if you plan to use the browser
- **SSH**: add your SSH public key (disable password SSH if prompted)
- **Networking**:
  - Public IPv4 enabled (you can keep inbound locked down; Tailscale uses outbound)
- **Backups** (recommended): enable if you want quick restore

#### Firewall recommendation

Keep the OpenClaw Gateway port private. At minimum:

- Allow inbound **SSH 22** from your IP(s)
- Do **not** open `18789` to the public internet

Tailscale will handle private access; Funnel will expose only `/googlechat` on a Tailscale domain.

### Step 2: SSH into the VPS

From your machine:

```bash
ssh root@<YOUR_VPS_IP>
```

### Step 3: Bootstrap (dedicated `openclaw` user + install)

This repo includes a bootstrap script:

- `openclaw/scripts/vps-bootstrap.sh`

Run it on the VPS (as root):

```bash
bash openclaw/scripts/vps-bootstrap.sh
```

If you prefer manual install, the key steps are:

- Install prereqs (`curl`, `git`, `ca-certificates`)
- Install Tailscale
- Install OpenClaw using the official installer
- Run onboarding as the dedicated Linux user `openclaw`

### Step 4: Authenticate Tailscale

On the VPS:

```bash
tailscale up
```

You’ll follow the URL to authenticate the node into your tailnet.

### Step 5: Put config + workspace “mind” files in place

OpenClaw has two important directories:

- **State**: `~/.openclaw/` (config, credentials, sessions, logs)
- **Workspace**: configured by `agents.defaults.workspace` (the agent’s “mind”: `SOUL.md`, `USER.md`, etc.)

This repo provides templates:

- Config template: `openclaw/config/openclaw.example.json5`
- Workspace template: `openclaw/workspace-template/`

On the VPS, as `openclaw` user:

```bash
sudo -iu openclaw

# 1) State/config
mkdir -p ~/.openclaw

# Create ~/.openclaw/openclaw.json from openclaw/config/openclaw.example.json5
# (copy/paste the file contents, or scp it over)

chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/openclaw.json || true

# 2) Workspace (agent mind)
mkdir -p ~/.openclaw/workspace/muni-health

# Copy the contents of openclaw/workspace-template/* into:
#   ~/.openclaw/workspace/muni-health/
```

### Step 6: Set OpenRouter key via `~/.openclaw/.env`

Create:

```bash
cat > ~/.openclaw/.env <<'EOF'
OPENROUTER_API_KEY="sk-or-..."
EOF

chmod 600 ~/.openclaw/.env
```

### Step 7: Enable the Google Chat plugin (bundled plugins ship disabled)

```bash
openclaw plugins enable googlechat
openclaw gateway restart
```

### Step 8: Set up Serve + Funnel (private dashboard, public `/googlechat` only)

Run the helper script:

- `openclaw/scripts/tailscale-funnel-googlechat.sh`

On the VPS (as `openclaw` user or root), run:

```bash
bash openclaw/scripts/tailscale-funnel-googlechat.sh
```

This configures:

- Private dashboard: `https://<node>.<tailnet>.ts.net:8443/`
- Public webhook: `https://<node>.<tailnet>.ts.net/googlechat`

### Step 9: Browser on the VPS (headless) sanity checks

Your config template enables headless OpenClaw-managed browser.

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

If you hit Playwright/browser install errors, follow the OpenClaw browser docs and ensure Playwright + Chromium are available for your install.

### Step 10: Verify health + security

```bash
openclaw doctor
openclaw status
openclaw channels status --probe
openclaw logs --follow
openclaw security audit --deep
```

### Next: Google Chat integration

Proceed to: `openclaw/deploy/GOOGLE_CHAT_INTEGRATION.md`
