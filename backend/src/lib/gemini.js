import { GoogleGenAI } from "@google/genai";
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
  isMalformedGoogleKey,
} from "./aiErrors.js";

// ---------------------------------------------------------------------------
// Gemini AI client (Google GenAI SDK)
// FALLBACK PROVIDER — Groq is primary; Gemini is used automatically when Groq
// fails (see lib/ai.js). The API key lives ONLY in backend/.env
// (GEMINI_API_KEY) and is never exposed to the frontend. dotenv is loaded in
// lib/env.js via "dotenv/config".
//
// MODEL: defaulted here to a current generally-available model. The previously
// configured "gemini-2.5-flash" is rejected by Google's API with HTTP 404
// ("no longer available to new users") — Google's own error directs clients to
// "gemini-3.6-flash". "gemini-2.0-flash" was retired in earlier runs. This can
// be overridden via GEMINI_MODEL in backend/.env without touching code.
const MODEL = ENV.GEMINI_MODEL || "gemini-3.6-flash";

// Timeout for each Gemini request attempt (ms). The GenAI SDK does not reliably
// honour an AbortSignal, so this is enforced with a Promise.race below.
const REQUEST_TIMEOUT = 30000;

// Startup diagnostic — logs presence only, never the key itself.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[AI] Gemini initializing. GEMINI_API_KEY ${ENV.GEMINI_API_KEY ? "loaded ✓" : "NOT set ✗ (provider will fail)"} · model: ${MODEL}`
    );
  }

export const genAI = new GoogleGenAI({
  apiKey: ENV.GEMINI_API_KEY,
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

// A single Gemini attempt with a HARD timeout (Promise.race). If the SDK does
// not resolve, the timeout rejects with a TimeoutError so we never hang.
const runOnce = async (systemPrompt, userContent, temperature) => {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("Gemini request timed out"), { name: "TimeoutError", code: "ETIMEDOUT", status: 504 })),
      REQUEST_TIMEOUT
    );
  });
  const task = genAI.models.generateContent({
    model: MODEL,
    contents: `${systemPrompt}\n\n${userContent}`,
    config: { temperature },
  });
  try {
    const result = await Promise.race([task, timeoutPromise]);
    const content = result?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "";
    if (!content) {
      throw new AIProviderError(
        "gemini",
        AI_CATEGORIES.INVALID,
        "Gemini returned empty content",
        { finishReason: result?.candidates?.[0]?.finishReason }
      );
    }
    return content;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// Runs a single Gemini generateContent with a timeout and retries ONLY on
// transient provider errors. Rate limits fall through immediately so the
// unified service can try its other provider without multiplying quota usage.
const generate = async (systemPrompt, userContent, { temperature = 0.7 } = {}) => {
  const provider = "gemini";
  // Fail fast for a missing/placeholder/malformed key so the failure is
  // categorized as AUTH without a wasted provider call.
  if (!ENV.GEMINI_API_KEY || !ENV.GEMINI_API_KEY.trim() || isPlaceholderKey(ENV.GEMINI_API_KEY)) {
    throw new AIProviderError(
      provider,
      AI_CATEGORIES.AUTH,
      "Gemini API key is missing or a placeholder — set a real GEMINI_API_KEY in backend/.env."
    );
  }
  if (isMalformedGoogleKey(ENV.GEMINI_API_KEY)) {
    throw new AIProviderError(
      provider,
      AI_CATEGORIES.AUTH,
      "Gemini API key does not look like a valid Google API key (expected prefix AIza…) — set a real GEMINI_API_KEY in backend/.env."
    );
  }
  let attempt = 0;
  let lastErr = null;
  while (attempt <= RETRY_MAX) {
    try {
      return await runOnce(systemPrompt, userContent, temperature);
    } catch (err) {
      const categorized = classifyErr(provider, err);
      lastErr = categorized;
      logProviderError(
        provider,
        categorized.category,
        `status=${err?.status ?? err?.statusCode ?? "n/a"} attempt=${attempt + 1} model=${MODEL}`
      );
      if (!shouldRetry(categorized.category)) throw categorized;
      attempt += 1;
      if (attempt > RETRY_MAX) break;
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw lastErr || new Error("[gemini] generate failed");
};

export { formatMessages, generate };
