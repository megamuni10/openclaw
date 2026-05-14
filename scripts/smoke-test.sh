#!/usr/bin/env bash
# Otto smoke test — runs after every build/update, before declaring success.
#
# Tests three things in order:
#   1. Config sanity  — openclaw.json has required fields, model is in the safe list
#   2. Patch presence — all otto patches are in the build (delegates to otto:verify)
#   3. Model live     — configured model responds with a text token in <10s
#
# Exit 0 = safe to keep the gateway running.
# Exit 1 = something is broken — investigate before serving real traffic.
#
# Usage:
#   /root/openclaw/scripts/smoke-test.sh
#   (or via: pnpm otto:smoke)
#
# Run this AFTER `systemctl restart openclaw-gateway` and AFTER a few seconds wait.
# If it exits 1, do not declare the update successful.

set -euo pipefail

FORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="/home/openclaw/.openclaw/openclaw.json"
SERVICE="/home/openclaw/.config/systemd/user/openclaw-gateway.service"

PASS=0
FAIL=0

# ─── helpers ──────────────────────────────────────────────────────────────────

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

ok()   { green "  ✓  $*"; PASS=$((PASS + 1)); }
fail() { red   "  ✗  $*"; FAIL=$((FAIL + 1)); }

# ─── 1. config sanity ─────────────────────────────────────────────────────────

bold "\n1. Config sanity"

MODEL_RAW=$(python3 -c "
import json, sys
try:
    d = json.load(open('$CONFIG'))
    print(d['agents']['defaults']['model']['primary'])
except Exception as e:
    print('ERROR: ' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>/dev/null) || { fail "cannot read primary model from openclaw.json"; MODEL_RAW=""; }

if [[ -n "$MODEL_RAW" ]]; then
    ok "primary model: $MODEL_RAW"

    # Reject ~google/ tilde aliases — they route to always-thinking models
    if [[ "$MODEL_RAW" == *"~google/"* ]]; then
        fail "model uses ~google/ alias — routes to a default-thinking model, will timeout (use google/gemini-2.5-flash-lite instead)"
    else
        ok "model is not a ~google/ tilde alias"
    fi
fi

# sessions_spawn attachments
ATTACH=$(python3 -c "
import json
d = json.load(open('$CONFIG'))
print(d.get('tools', {}).get('sessions_spawn', {}).get('attachments', {}).get('enabled', False))
" 2>/dev/null) || ATTACH="false"
if [[ "$ATTACH" == "True" ]]; then
    ok "sessions_spawn.attachments.enabled = true"
else
    fail "sessions_spawn.attachments.enabled is not true — file forwards will fail silently"
fi

# thinkingDefault sanity: defaults should be 'high' (for gpt-5.5 subagents),
# but the main agent list entry must have 'off' or the global leaks to Gemini
THINKING_DEFAULT=$(python3 -c "
import json
d = json.load(open('$CONFIG'))
print(d.get('agents', {}).get('defaults', {}).get('thinkingDefault', 'MISSING'))
" 2>/dev/null) || THINKING_DEFAULT="ERROR"

THINKING_MAIN=$(python3 -c "
import json
d = json.load(open('$CONFIG'))
agents = d.get('agents', {}).get('list', [])
main = next((a for a in agents if a.get('id') == 'main'), None)
print(main.get('thinkingDefault', 'MISSING') if main else 'NO_MAIN_AGENT')
" 2>/dev/null) || THINKING_MAIN="ERROR"

if [[ "$THINKING_DEFAULT" == "high" ]]; then
    ok "agents.defaults.thinkingDefault = high (for gpt-5.5 subagents)"
else
    fail "agents.defaults.thinkingDefault = $THINKING_DEFAULT (expected 'high' for gpt-5.5 subagent reasoning)"
fi

if [[ "$THINKING_MAIN" == "off" ]]; then
    ok "main agent thinkingDefault = off"
else
    fail "main agent thinkingDefault = $THINKING_MAIN (expected 'off' — global 'high' will leak to Gemini and cause 120s timeouts)"
fi

# ─── 2. patch presence ────────────────────────────────────────────────────────

bold "\n2. Patch presence"

if cd "$FORK_DIR" && pnpm --silent otto:verify 2>&1; then
    ok "all otto patches present in build"
else
    fail "one or more otto patches missing from build — run pnpm otto:verify for details"
fi

# ─── 3. model live test ───────────────────────────────────────────────────────

bold "\n3. Model live test"

# Extract API key from service file (source of truth for runtime env)
API_KEY=$(grep -o 'OPENROUTER_API_KEY=sk-or-[^ ]*' "$SERVICE" 2>/dev/null | cut -d= -f2 || true)

if [[ -z "$API_KEY" ]]; then
    fail "cannot find OPENROUTER_API_KEY in service file — skipping live test"
else
    ok "found API key"

    # Strip openrouter/ prefix for the actual API call
    MODEL_ID="${MODEL_RAW#openrouter/}"

    echo "     testing model: $MODEL_ID"
    echo "     threshold: 10s TTFT, reasoning_tokens must be 0"

    START_MS=$(date +%s%3N)

    # Stream a minimal request, capture TTFT and reasoning_tokens
    # Using python to parse SSE stream and exit on first content token
    # Write SSE parser to a temp file so the heredoc doesn't fight with the subshell
    PARSER=$(mktemp /tmp/otto-smoke-XXXXXX.py)
    trap "rm -f $PARSER" EXIT

    cat > "$PARSER" << 'PYEOF'
import sys, json, time

start_ms = int(sys.argv[1]) if len(sys.argv) > 1 else 0
ttft = None
reasoning_tokens = None

for line in sys.stdin:
    line = line.strip()
    if not line.startswith("data: "):
        continue
    payload = line[6:]
    if payload == "[DONE]":
        break
    try:
        d = json.loads(payload)
    except Exception:
        continue

    choices = d.get("choices", [])
    if choices and ttft is None:
        content = choices[0].get("delta", {}).get("content", "")
        if content:
            now_ms = int(time.time() * 1000)
            ttft = now_ms - start_ms

    usage = d.get("usage")
    if usage:
        details = usage.get("completion_tokens_details") or {}
        reasoning_tokens = details.get("reasoning_tokens", 0)

print(f"TTFT={ttft if ttft is not None else 'TIMEOUT'}")
print(f"REASONING={reasoning_tokens if reasoning_tokens is not None else 'UNKNOWN'}")
PYEOF

    RESULT=$(timeout 12 curl -s -N \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -X POST "https://openrouter.ai/api/v1/chat/completions" \
        -d "{
          \"model\": \"$MODEL_ID\",
          \"messages\": [{\"role\": \"user\", \"content\": \"say: ok\"}],
          \"stream\": true,
          \"max_tokens\": 10,
          \"stream_options\": {\"include_usage\": true}
        }" 2>/dev/null | python3 "$PARSER" "$START_MS" || echo "TTFT=TIMEOUT
REASONING=UNKNOWN")

    TTFT_VAL=$(echo "$RESULT" | grep '^TTFT=' | cut -d= -f2)
    REASONING_VAL=$(echo "$RESULT" | grep '^REASONING=' | cut -d= -f2)

    if [[ "$TTFT_VAL" == "TIMEOUT" ]] || [[ -z "$TTFT_VAL" ]]; then
        fail "model did not return a text token within 12s — idle timeout will fire in production"
    else
        echo "     TTFT: ${TTFT_VAL}ms"
        if [ "$TTFT_VAL" -gt 10000 ]; then
            fail "TTFT ${TTFT_VAL}ms exceeds 10s threshold — likely in extended thinking mode"
        else
            ok "TTFT ${TTFT_VAL}ms (under 10s)"
        fi
    fi

    if [[ "$REASONING_VAL" == "UNKNOWN" ]]; then
        ok "reasoning_tokens: unknown (no usage chunk — not necessarily a problem)"
    elif [[ "$REASONING_VAL" == "0" ]]; then
        ok "reasoning_tokens: 0 (model is not thinking)"
    else
        fail "reasoning_tokens: $REASONING_VAL — model is doing native thinking, will slow responses for complex prompts"
    fi
fi

# ─── summary ──────────────────────────────────────────────────────────────────

echo ""
if [ "$FAIL" -eq 0 ]; then
    green "All checks passed ($PASS/$((PASS+FAIL))) — gateway is healthy"
    exit 0
else
    red "$FAIL check(s) failed ($PASS passed) — investigate before serving real traffic"
    exit 1
fi
