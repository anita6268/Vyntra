
import "dotenv/config";

// -- Normalize NODE_ENV so downstream checks (`=== "production"`) are reliable --
const rawNodeEnv = process.env.NODE_ENV?.trim().toLowerCase() || "development";

// -- Normalize ARCJET_ENV (Arcjet expects exactly "development" or "production") --
const rawArcjetEnv =
  process.env.ARCJET_ENV?.trim().toLowerCase() || rawNodeEnv;

export const ENV = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: rawNodeEnv,
  CLIENT_URL: process.env.CLIENT_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  ARCJET_KEY: process.env.ARCJET_KEY,
  ARCJET_ENV: rawArcjetEnv,
  // Strip ALL whitespace (spaces/newlines/tabs) from pasted API keys — a wrapped
  // or double-pasted key (e.g. "gsk_ ... gsk_...") can never authenticate.
  // Never logged; only presence/shape is checked elsewhere.
  GROQ_API_KEY: process.env.GROQ_API_KEY?.replace(/\s+/g, ""),
  // Optional override for the Groq chat model. Groq model availability is
  // account-specific (e.g. "llama-3.1-8b-instant" 404s on keys that only
  // expose the gpt-oss/qwen families), so operators can pin a model their
  // key actually exposes here. Blank == use the auto candidates in
  // lib/groq.js (openai/gpt-oss-20b first). Never logged; only presence is checked.
  GROQ_MODEL: process.env.GROQ_MODEL?.trim() || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY?.replace(/\s+/g, ""),
  // Optional override for the Gemini model (validated default in gemini.js).
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  // -- Payment gateway (one of: "none" | "stripe" | "razorpay") --
  PAYMENT_PROVIDER: (process.env.PAYMENT_PROVIDER || "none")
    .trim()
    .toLowerCase(),
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  VYNTRA_PRO_PRICE_MONTHLY: process.env.VYNTRA_PRO_PRICE_MONTHLY || "499",
  VYNTRA_PRO_PRICE_YEARLY: process.env.VYNTRA_PRO_PRICE_YEARLY || "4790",
  // -- Optional TURN relay for WebRTC 1-to-1 calls -------------------------
  // These are NEVER hardcoded — they come from the environment. When any of the
  // three is missing the call flow falls back to STUN-only (no crash, dev warning).
  TURN_URL: process.env.TURN_URL || "",
  TURN_USERNAME: process.env.TURN_USERNAME || "",
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "",
};
