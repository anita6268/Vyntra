// ---------------------------------------------------------------------------
// Unified AI provider with automatic fallback.
// Primary provider: Groq  →  Fallback provider: Gemini
//
// All AI controllers import generate / formatMessages / friendlyError from
// THIS module so the failover logic lives in exactly one place and is not
// duplicated across the codebase.
//
// Error policy: full provider/error details are logged to the backend console
// ONLY (provider name + category via logProviderError). Raw API errors, keys,
// stack traces and provider URLs are never sent to the frontend. When BOTH
// providers fail the client receives a single sanitized, generic message.
// ---------------------------------------------------------------------------
import { generate as groqGenerate } from "./groq.js";
import { generate as geminiGenerate } from "./gemini.js";
import { formatMessages } from "./groq.js";
import { ENV } from "./env.js";
import {
  AIProviderError,
  AI_CATEGORIES,
  classifyErr,
  logProviderError,
  truncatePrompt,
} from "./aiErrors.js";

// Deliberately generic, user-friendly message shown when BOTH providers fail and
// no more specific category applies.
const GENERIC_AI_ERROR =
  "The AI assistant is currently unavailable. Please try again in a moment.";

// Maps a provider error category to the HTTP status the API controller should
// return so the frontend can surface a precise, actionable message.
const CATEGORY_HTTP_STATUS = {
  [AI_CATEGORIES.AUTH]: 503,
  [AI_CATEGORIES.RATE]: 429,
  [AI_CATEGORIES.MODEL]: 502,
  [AI_CATEGORIES.SERVER]: 502,
  [AI_CATEGORIES.TIMEOUT]: 504,
  [AI_CATEGORIES.NETWORK]: 502,
  [AI_CATEGORIES.INVALID]: 502,
  [AI_CATEGORIES.UNKNOWN]: 500,
};

// Machine-readable error codes returned as `code` alongside the sanitized
// `message` so the frontend can distinguish auth / model / rate-limit cases.
const CATEGORY_CODE = {
  [AI_CATEGORIES.AUTH]: "AI_PROVIDER_AUTH_FAILED",
  [AI_CATEGORIES.RATE]: "AI_RATE_LIMITED",
  [AI_CATEGORIES.MODEL]: "AI_MODEL_NOT_FOUND",
  [AI_CATEGORIES.SERVER]: "AI_PROVIDER_FAILED",
  [AI_CATEGORIES.TIMEOUT]: "AI_PROVIDER_FAILED",
  [AI_CATEGORIES.NETWORK]: "AI_PROVIDER_FAILED",
  [AI_CATEGORIES.INVALID]: "AI_PROVIDER_FAILED",
  [AI_CATEGORIES.UNKNOWN]: "AI_PROVIDER_FAILED",
};

// Human-readable, user-facing messages keyed by provider error category.
// These are sanitized — they never include raw API errors, keys, or URLs.
const CATEGORY_MESSAGE = {
  [AI_CATEGORIES.AUTH]:
    "AI provider authentication failed. Check API keys in backend/.env.",
  [AI_CATEGORIES.RATE]: "AI service rate limit reached. Try again shortly.",
  [AI_CATEGORIES.MODEL]:
    "AI model is not available. Check the configured model name in backend/.env.",
  [AI_CATEGORIES.SERVER]:
    "AI provider failed. Check backend configuration/logs.",
  [AI_CATEGORIES.TIMEOUT]:
    "AI request timed out. The provider is slow — try again.",
  [AI_CATEGORIES.NETWORK]:
    "Cannot connect to AI provider. Check network configuration.",
  [AI_CATEGORIES.INVALID]:
    "AI provider returned an error (likely invalid API key or model name). Check backend/.env.",
  [AI_CATEGORIES.UNKNOWN]: GENERIC_AI_ERROR,
};

// Startup validation for both provider API keys. Missing or placeholder keys are
// logged clearly (server-side only; the key itself is never printed) so a
// misconfigured backend is obvious, but the server still boots — the affected
// provider simply logs a categorized error at request time and falls through.
export const validateApiKeys = () => {
  for (const { name, value } of [
    { name: "GROQ_API_KEY", value: ENV.GROQ_API_KEY },
    { name: "GEMINI_API_KEY", value: ENV.GEMINI_API_KEY },
  ]) {
    const set = typeof value === "string" && value.trim() !== "";
    const placeholder = set && /YOUR_|HERE/i.test(value);
    // Detect obviously-malformed keys that will never authenticate (wrong prefix).
    const malformed =
      set &&
      name === "GEMINI_API_KEY" &&
      !/^AIza[a-zA-Z0-9_-]{35}/.test(value.trim());
    if (!set) {
      console.warn(`[AI] ${name} is NOT set — that provider will fail. Add it to backend/.env.`);
    } else if (placeholder) {
      console.warn(`[AI] ${name} looks like a placeholder — that provider will fail until a real key is set in backend/.env.`);
    } else if (malformed) {
      console.warn(`[AI] ${name} is set but does not look like a valid Google API key (expected prefix "AIza…"). That provider will fail until a real key is set in backend/.env.`);
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[AI] ${name} validated ✓`);
      }
    }
  }
};

// Runs the prompt through Groq first; on a Groq failure it automatically retries
// the transient cases (handled inside groq.js) and then falls back to Gemini.
// If BOTH providers fail it throws a categorized AIProviderError (using the
// fallback provider's category) so controllers can return a precise status code
// and the frontend can show a meaningful message instead of a generic one.
export const generate = async (systemPrompt, userContent, options = {}) => {
  // If neither provider key is configured at all, fail fast with a clear message
  // instead of attempting two doomed provider calls that would both 404.
  if (!ENV.GROQ_API_KEY && !ENV.GEMINI_API_KEY) {
    throw new AIProviderError(
      "ai",
      AI_CATEGORIES.AUTH,
      "AI provider is not configured — neither GROQ_API_KEY nor GEMINI_API_KEY is set in backend/.env."
    );
  }

  // Bound the payload so oversized conversation context can never trigger
  // token-limit / 413 failures before any provider call is made.
  const { systemPrompt: sys, userContent: usr } = truncatePrompt(systemPrompt, userContent);

  try {
    // 1) PRIMARY provider — Groq
    return await groqGenerate(sys, usr, options);
  } catch (groqErr) {
    const groqInfo = classifyErr("groq", groqErr);
    logProviderError("groq", groqInfo.category, "primary failed — switching to Gemini fallback");

    try {
      // 2) FALLBACK provider — Gemini
      return await geminiGenerate(sys, usr, options);
    } catch (geminiErr) {
      const geminiInfo = classifyErr("gemini", geminiErr);
      logProviderError("gemini", geminiInfo.category, "fallback also failed — returning categorized error");
      // Both providers failed. Throw a SINGLE categorized error that preserves the
      // fallback provider's category (Gemini) so controllers + frontend can show a
      // specific message. The original provider errors are attached as `cause` for
      // server-side diagnostics — they are NEVER sent to the client.
      throw new AIProviderError(
        "ai",
        geminiInfo.category,
        `Both AI providers failed — Groq (${groqInfo.category}) and Gemini (${geminiInfo.category}).`,
        { groq: groqInfo, gemini: geminiInfo }
      );
    }
  }
};

// Convert a provider error into a sanitized, user-facing message.
// If the error carries a category (AIProviderError), return the matching message.
// Otherwise fall back to the generic message. In development, the raw error
// detail is appended for easier debugging — it is never shown in production.
// Key-like tokens are redacted from the dev detail so keys can't leak via UI.
const redactSecrets = (text) =>
  String(text || "")
    .replace(/gsk_[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");

export const friendlyError = (error) => {
  if (!error) return GENERIC_AI_ERROR;
  const cat = error?.category || AI_CATEGORIES.UNKNOWN;
  let msg = CATEGORY_MESSAGE[cat] || GENERIC_AI_ERROR;
  if (ENV.NODE_ENV !== "production") {
    const detail = redactSecrets(error?.message || "");
    if (detail && detail !== GENERIC_AI_ERROR) {
      msg = `${msg} (${detail})`;
    }
  }
  return msg;
};

// Map an AI provider error to the HTTP status the controller should return.
export const errorToHttpStatus = (error) => {
  const cat = error?.category || AI_CATEGORIES.UNKNOWN;
  return CATEGORY_HTTP_STATUS[cat] ?? 500;
};

// Map an AI provider error to its machine-readable code for the `code` field.
export const errorToCode = (error) => {
  const cat = error?.category || AI_CATEGORIES.UNKNOWN;
  return CATEGORY_CODE[cat] ?? "AI_PROVIDER_FAILED";
};

// Re-exported so every consumer uses a single formatMessages implementation.
// Also expose GENERIC_AI_ERROR and the category map for tests / diagnostics.
export { formatMessages, GENERIC_AI_ERROR };