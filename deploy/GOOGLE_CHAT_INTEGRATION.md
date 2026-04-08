# OpenClaw ↔ Google Chat Integration (Webhook-only)

This guide configures a **private** Google Chat app for your domain that forwards messages to OpenClaw via **HTTP webhooks**.

OpenClaw docs highlights:

- Google Chat requires a **public HTTPS** endpoint for webhooks.
- For security, **only expose** the `/googlechat` path to the internet.

## What you’ll need

- OpenClaw Gateway running on your VPS
- A public webhook URL for `/googlechat` (recommended: **Tailscale Funnel**)
- Google Cloud project access

### Step 1: Create Google Cloud project + enable API

1. Create/select a Google Cloud project.
2. Enable the **Google Chat API**.

### Step 2: Create a Service Account + JSON key

1. Create a **Service Account** (name e.g. `openclaw-chat`).
2. Generate a **JSON key** for that service account.
3. Copy that JSON file to the VPS (as the `openclaw` user), example path:

```bash
~/.openclaw/googlechat-service-account.json
```

Keep its permissions tight:

```bash
chmod 600 ~/.openclaw/googlechat-service-account.json
```

### Step 3: Create the Google Chat app (Chat Configuration)

In Google Cloud Console → Google Chat API → Configuration:

- **Application info**
  - App name: `OpenClaw` (or `MegaMuni`)
  - Avatar URL: e.g. `https://openclaw.ai/logo.png`
  - Description: `Executive assistant`
- Enable **Interactive features**
- Under **Functionality**, enable **Join spaces and group conversations**
- Under **Connection settings**
  - Choose **HTTP endpoint URL**
- Under **Triggers**
  - Choose **Use a common HTTP endpoint URL for all triggers**
  - Set it to your **public URL** + `/googlechat`

If you’re using Tailscale Funnel, the public URL looks like:

`https://<node>.<tailnet>.ts.net/googlechat`

- Under **Visibility**
  - Make the app available to specific people/groups in your domain
  - Add your email
- Save
- After saving, refresh and set **App status** to **Live**

### Step 4: Configure OpenClaw (`~/.openclaw/openclaw.json`)

This repo includes a template:

- `openclaw/config/openclaw.example.json5`

Key fields you must set:

- `channels.googlechat.serviceAccountFile`
- `channels.googlechat.audienceType`
- `channels.googlechat.audience` (must match your Chat app webhook URL)
- Ensure the plugin is enabled:
  - `plugins.entries.googlechat.enabled: true`

Example (trimmed):

```js
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/home/openclaw/.openclaw/googlechat-service-account.json",
      audienceType: "app-url",
      audience: "https://<node>.<tailnet>.ts.net/googlechat",
      webhookPath: "/googlechat",
      dm: { policy: "pairing" },
      groupPolicy: "allowlist",
    },
  },
  plugins: { entries: { googlechat: { enabled: true } } },
}
```

Restart:

```bash
openclaw gateway restart
openclaw channels status --probe
```

### Step 5: Expose ONLY `/googlechat` publicly (recommended)

Use Tailscale Serve + Funnel to keep the dashboard private and expose only the webhook path.

This repo includes:

- `openclaw/scripts/tailscale-funnel-googlechat.sh`

Run it on the VPS:

```bash
bash tailscale-funnel-googlechat.sh
```

### Step 6: Add the bot in Google Chat

1. Go to Google Chat (`chat.google.com`).
2. Click **+** next to Direct Messages.
3. Search for the app name (it won’t show in the marketplace list if private).
4. Add it and send “Hello”.

### Step 7: Pairing approvals (DMs)

If DMs are set to `pairing`, unknown senders get a pairing code. Approve it:

```bash
openclaw pairing approve googlechat <code>
```

### Troubleshooting (fast)

Run these while sending a test message:

```bash
openclaw channels status --probe
openclaw logs --follow
```

Common issues:

- **405 Method Not Allowed**: channel config missing or plugin disabled; restart gateway after config changes.
- **No messages arriving**: webhook URL wrong, Funnel not enabled, or audience mismatch.
- **Mention gating blocks replies in spaces**: ensure `requireMention` behavior matches your desired setup.
