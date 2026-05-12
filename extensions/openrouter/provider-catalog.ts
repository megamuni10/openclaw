import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_LEGACY_BASE_URL = "https://openrouter.ai/v1";
const OPENROUTER_DEFAULT_MODEL_ID = "openrouter/auto";
const OPENROUTER_DEFAULT_CONTEXT_WINDOW = 200000;
const OPENROUTER_DEFAULT_MAX_TOKENS = 8192;
const OPENROUTER_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
const OPENROUTER_PROXY_REASONING_UNSUPPORTED_MODEL_IDS = new Set(["openrouter/hunter-alpha"]);

// Google models use native thinkingConfig, not OpenAI-style reasoning.effort.
// Sending reasoning.effort to Gemini via OpenRouter puts it into thinking mode
// with a large token budget, causing TTFT well above the 120s idle watchdog.
function isOpenRouterGoogleModelId(normalized: string): boolean {
  return (
    normalized.startsWith("google/") ||
    normalized.startsWith("~google/") ||
    normalized.startsWith("openrouter/google/") ||
    normalized.startsWith("openrouter/~google/")
  );
}
const OPENROUTER_KIMI_K2_6_COST = {
  input: 0.8,
  output: 3.5,
  cacheRead: 0.2,
  cacheWrite: 0,
};

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "").trim().replace(/\/+$/, "");
}

export function normalizeOpenRouterBaseUrl(baseUrl: string | undefined): string | undefined {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return undefined;
  }
  if (normalized === OPENROUTER_BASE_URL || normalized === OPENROUTER_LEGACY_BASE_URL) {
    return OPENROUTER_BASE_URL;
  }
  return undefined;
}

export function isOpenRouterProxyReasoningUnsupportedModel(modelId: string | undefined): boolean {
  const normalized = (modelId ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    OPENROUTER_PROXY_REASONING_UNSUPPORTED_MODEL_IDS.has(normalized) ||
    normalized.startsWith("openrouter/hunter-alpha:") ||
    isOpenRouterGoogleModelId(normalized)
  );
}

export function buildOpenrouterProvider(): ModelProviderConfig {
  return {
    baseUrl: OPENROUTER_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: OPENROUTER_DEFAULT_MODEL_ID,
        name: "OpenRouter Auto",
        reasoning: false,
        input: ["text", "image"],
        cost: OPENROUTER_DEFAULT_COST,
        contextWindow: OPENROUTER_DEFAULT_CONTEXT_WINDOW,
        maxTokens: OPENROUTER_DEFAULT_MAX_TOKENS,
      },
      {
        id: "moonshotai/kimi-k2.6",
        name: "MoonshotAI: Kimi K2.6",
        reasoning: true,
        input: ["text", "image"],
        cost: OPENROUTER_KIMI_K2_6_COST,
        contextWindow: 262144,
        maxTokens: 262144,
      },
    ],
  };
}
