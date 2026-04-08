import { createHash } from "node:crypto";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { streamWithPayloadPatch } from "./stream-payload-utils.js";

/** OpenRouter does not document a hard limit; keep ids reasonably small for proxies and logs. */
const OPENROUTER_SESSION_ID_MAX_LEN = 200;

function modelUsesOpenRouterHttp(model: { baseUrl?: unknown; provider?: unknown }): boolean {
  if (typeof model.baseUrl === "string" && model.baseUrl.toLowerCase().includes("openrouter.ai")) {
    return true;
  }
  return model.provider === "openrouter";
}

/**
 * OpenRouter Logs "Sessions" groups requests that share the same `session_id` body field.
 * Uses the OpenClaw session key when present so provider logs correlate with gateway/session files.
 */
export function formatOpenRouterSessionId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.length <= OPENROUTER_SESSION_ID_MAX_LEN) {
    return trimmed;
  }
  const digest = createHash("sha256").update(trimmed).digest("hex").slice(0, 24);
  return `oc:${digest}`;
}

export function createOpenRouterSessionGroupingWrapper(
  baseStreamFn: StreamFn | undefined,
  groupingId: string | undefined,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  const sessionId = groupingId?.trim() ? formatOpenRouterSessionId(groupingId) : "";
  if (!sessionId) {
    return underlying;
  }

  return (model, context, options) => {
    if (!modelUsesOpenRouterHttp(model)) {
      return underlying(model, context, options);
    }
    return streamWithPayloadPatch(underlying, model, context, options, (payloadObj) => {
      if (payloadObj.session_id === undefined) {
        payloadObj.session_id = sessionId;
      }
    });
  };
}
