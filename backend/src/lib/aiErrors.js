// ---------------------------------------------------------------------------
// Shared, self-contained error taxonomy + resilience helpers for the Vyntra AI
// stack. Used by BOTH providers (groq.js / gemini.js) and the unified
// orchestrator (ai.js) — importing from here avoids circular dependencies.
//
// Policy:
//   - Auth / invalid / unknown errors are NEVER retried.
//   - Transient errors (5xx server, timeout, network) ARE
//     retried a limited number of times, then fall back to the other provider.
//   - All logging is server-side only and never includes API keys or full error
//     bodies (which may echo provider URLs / requests).
// ---------------------------------------------------------------------------

export const AI_CATEGORIES = {
  AUTH: "auth",
  RATE: "rate",
  MODEL: "model",
  SERVER: "server",
  TIMEOUT: "timeout",
  NETWORK: "network",
  INVALID: "invalid",
  UNKNOWN: "unknown",
};

export class AIProviderError extends Error {
  constructor(provider, category, message, cause) {
    super(message || `[${provider}] ${category} error`);
    this.name = "AIProviderError";
    this.provider = provider;
    this.category = category;
    this.cause = cause;
  }
}

// Shared placeholder patterns — a placeholder key must NEVER be treated as
// valid or sent to a provider (it can only produce confusing auth errors).
const PLACEHOLDER_RE = /YOUR_|HERE|changeme|replace[_-]?me|<.*>/i;

export const isPlaceholderKey = (value) =>
  typeof value === "string" && PLACEHOLDER_RE.test(value.trim());

// A Google API key that will never authenticate (wrong prefix) — checked
// locally so the failure is categorized as AUTH without a wasted provider call.
export const isMalformedGoogleKey = (value) =>
  typeof value === "string" &&
  value.trim() !== "" &&
  !/^AIza[a-zA-Z0-9_-]{35}/.test(value.trim());

// Normalize any thrown value into an AIProviderError with a category.
// Already-normalized errors pass through unchanged.
export const classifyErr = (provider, err) => {
  if (err instanceof AIProviderError) return err;

  const raw = err?.cause ?? err;
  const status = typeof raw?.status === "number" ? raw.status : typeof raw?.statusCode === "number" ? raw.statusCode : undefined;
  const code = raw?.code;
  const name = raw?.name;
  const text = `${raw?.message || ""} ${code || ""}`.toLowerCase();

  let category = AI_CATEGORIES.UNKNOWN;

  // Model-not-found / decommissioned / unsupported-model errors must be
  // distinguishable (AI_MODEL_NOT_FOUND) rather than lumped into INVALID.
  // Checked first because providers reuse HTTP 400/404 for both bad models
  // and bad credentials.
  if (
    /model_not_found|model not found|model_not_supported|models\/.*not found|the model .* does not exist|model .* does not exist|does not exist|no longer available|model_decommissioned|model decommissioned|decommissioned|unsupported model|invalid model|invalid_model|not_supported.*model|model.*not_supported|has been decommissioned|was decommissioned/i.test(text) ||
    /model_not_found|model_decommissioned|invalid_model/i.test(String(code || ""))
  ) {
    category = AI_CATEGORIES.MODEL;
  } else if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    raw?.type === "aborted" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    code === "ECONNABORTED" ||
    status === 408
  ) {
    category = AI_CATEGORIES.TIMEOUT;
  } else if (
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "EPIPE" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "ECONNREFUSED"
  ) {
    category = AI_CATEGORIES.NETWORK;
  } else if (typeof status === "number") {
    if (status === 401 || status === 403) category = AI_CATEGORIES.AUTH;
    else if (status === 429) category = AI_CATEGORIES.RATE;
    else if (status >= 500 && status <= 599) category = AI_CATEGORIES.SERVER;
    else if (status >= 400 && status < 500) category = AI_CATEGORIES.INVALID;
  } else if (code && /^(ECONN|ENET|EHOST|EADDR|ESOCKET|ETIMEDOUT|EAI_|ERR_HTTP_)/i.test(code)) {
    category = AI_CATEGORIES.NETWORK;
  }

  return new AIProviderError(provider, category, raw?.message || "Unknown error", raw);
};

// Only transient failures deserve a retry.
export const shouldRetry = (category) =>
  category === AI_CATEGORIES.SERVER ||
  category === AI_CATEGORIES.TIMEOUT ||
  category === AI_CATEGORIES.NETWORK;

// Retry budget per provider attempt (transient only).
export const RETRY_MAX = 2;
export const RETRY_BASE_DELAY_MS = 400;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Server-side-only log: provider name + error category (+ status). Never logs
// full messages, keys, request bodies, or provider URLs.
export const logProviderError = (provider, category, detail = "") => {
  const extra = detail ? ` :: ${detail}` : "";
  console.error(`[AI] ${provider} provider error :: category=${category}${extra}`);
};

// ---------------------------------------------------------------------------
// Payload bounding — guards against oversized conversation context / token
// limits before any provider call is made.
// ---------------------------------------------------------------------------
export const MAX_INPUT_CHARS = 16000;

export const limitText = (text, budget = MAX_INPUT_CHARS) => {
  if (typeof text !== "string") return "";
  if (text.length <= budget) return text;
  return `${text.slice(0, budget)}\n…[context trimmed]`;
};

// Reserve ~1/4 of the budget for the system prompt, the rest for user content.
export const truncatePrompt = (systemPrompt, userContent) => {
  const sysBudget = Math.floor(MAX_INPUT_CHARS / 4);
  const usrBudget = MAX_INPUT_CHARS - sysBudget;
  return {
    systemPrompt: limitText(systemPrompt, sysBudget),
    userContent: limitText(userContent, usrBudget),
  };
};