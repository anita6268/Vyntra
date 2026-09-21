import Groq from "groq-sdk";
import { ENV } from "./env.js";
import {
  classifyErr,
  shouldRetry,
  RETRY_MAX,
  RETRY_BASE_DELAY_MS,
  delay,
  logProviderError,
  AIProviderError,
  AI_CATEGORIES,
  isPlaceholderKey,
} from "./aiErrors.js";

// ---------------------------------------------------------------------------
// Groq AI client (official Groq SDK)
// GROQ IS THE PRIMARY PROVIDER — Gemini is only used as an automatic fallback
// (see lib/ai.js). The API key lives ONLY in backend/.env (GROQ_API_KEY) and is
// never exposed to the frontend. dotenv is loaded in lib/env.js via "dotenv/config".
//
// Resilience: a hard timeout is enforced per attempt, and retries happen ONLY
// for transient errors (5xx / timeout / network). Authentication, rate-limit,
// and invalid-request errors are thrown immediately and never retried.
// ---------------------------------------------------------------------------
// MODEL: Groq model availability is account-specific. Defaults below are the
// live working order for this key: openai/gpt-oss-20b responds (Sep 2026);
// llama-3.1-8b-instant 404s on this account. Override per environment via
// GROQ_MODEL in backend/.env (it is tried first). Remaining candidates are
// tried in order; model_not_found falls through to the next candidate, then
// to the Gemini fallback (lib/ai.js).
const MODEL_CANDIDATES = [
  ...(ENV.GROQ_MODEL ? [ENV.GROQ_MODEL] : []),
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "groq/compound-mini",
];
const MODEL = MODEL_CANDIDATES[0];

// Timeout for each Groq request attempt (ms).
const REQUEST_TIMEOUT = 30000;

// Startup diagnostic — logs presence only, never the key itself.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[AI] Groq initializing. GROQ_API_KEY ${ENV.GROQ_API_KEY ? "loaded ✓" : "NOT set ✗ (provider will fail)"} · model: ${MODEL}`
    );
  }

export const groq = new Groq({
  apiKey: ENV.GROQ_API_KEY,
});

// Maps message objects into a plain transcript string.
const formatMessages = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  return messages
    .map((m) => {
      const body = m.text || (m.image ? "[Shared image]" : "[Media]");
      return `${m.senderName || (m.senderId ? "Them" : "You")}: ${body}`;
    })
    .join("\n");
};

// A single Groq chat-completion attempt — no retry logic here.
const runOnce = async (systemPrompt, userContent, temperature, signal, model) => {
  const completion = await groq.chat.completions.create(
    {
      model,
      temperature,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    },
    { signal }
  );
  const content = completion?.choices?.[0]?.message?.content?.trim() || "";
  if (!content) {
    throw new AIProviderError(
      "groq",
      AI_CATEGORIES.INVALID,
      "Groq returned empty content",
      { status: completion?.choices?.[0]?.finish_reason }
    );
  }
  return content;
};

// Runs a single Groq chat completion with a timeout and retries ONLY on
// transient provider errors. Model candidates are tried in order: a
// model_not_found failure falls through to the NEXT candidate (account
// model availability varies), then to the Gemini fallback (lib/ai.js).
const generate = async (systemPrompt, userContent, { temperature = 0.7 } = {}) => {
  const provider = "groq";
  // Fail fast for a missing/placeholder key so the orchestrator can fall
  // through to Gemini WITHOUT a wasted provider call or a confusing auth error.
  if (!ENV.GROQ_API_KEY || !ENV.GROQ_API_KEY.trim() || isPlaceholderKey(ENV.GROQ_API_KEY)) {
    throw new AIProviderError(
      provider,
      AI_CATEGORIES.AUTH,
      "Groq API key is missing or a placeholder — set a real GROQ_API_KEY in backend/.env."
    );
  }
  for (const candidate of MODEL_CANDIDATES) {
    let attempt = 0;
    let lastErr = null;
    while (attempt <= RETRY_MAX) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        return await runOnce(systemPrompt, userContent, temperature, controller.signal, candidate);
      } catch (err) {
        const categorized = classifyErr(provider, err);
        lastErr = categorized;
        logProviderError(
          provider,
          categorized.category,
          `status=${err?.status ?? err?.statusCode ?? "n/a"} attempt=${attempt + 1} model=${candidate}`
        );
        // A missing/decommissioned model ID is permanent for THIS candidate —
        // try the next candidate instead of retrying the same model.
        if (categorized.category === AI_CATEGORIES.MODEL) break;
        if (!shouldRetry(categorized.category)) throw categorized;
        attempt += 1;
        if (attempt > RETRY_MAX) break;
        await delay(RETRY_BASE_DELAY_MS * attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastErr && lastErr.category === AI_CATEGORIES.MODEL) {
      logProviderError(provider, lastErr.category, `model ${candidate} unavailable — trying next candidate`);
      continue;
    }
    if (lastErr) throw lastErr;
  }
  throw new AIProviderError(
    provider,
    AI_CATEGORIES.MODEL,
    `None of the configured Groq models are available on this account (${MODEL_CANDIDATES.join(", ")}). Set GROQ_MODEL in backend/.env to a model your key exposes.`
  );
};

export { formatMessages, generate };
