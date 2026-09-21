// ─────────────────────────────────────────────────────────────────────────────
// Centralized environment validation for Vyntra backend.
//
// Loaded once at server startup (server.js). In production, missing secrets
// cause the process to exit with a clear, actionable error. In development the
// server still boots but prints warnings so local iteration is not blocked.
//
// This module NEVER prints secret values — only variable names and status.
// ─────────────────────────────────────────────────────────────────────────────
import { ENV } from "./env.js";

// ── Required in ALL environments ───────────────────────────────────────────
const ALWAYS_REQUIRED = ["JWT_SECRET", "MONGO_URI", "CLIENT_URL"];

// ── Required only in production (in addition to ALWAYS_REQUIRED) ────────────
const PROD_REQUIRED = [
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ARCJET_KEY",
  "ARCJET_ENV",
];

// ── Required only when PAYMENT_PROVIDER is set to stripe ────────────────────
const STRIPE_REQUIRED = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];

// ── Required only when PAYMENT_PROVIDER is set to razorpay ──────────────────
const RAZORPAY_REQUIRED = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];

// Patterns that indicate a placeholder / non-real value.
const PLACEHOLDER_PATTERNS = [
  /YOUR_/i,
  /HERE/i,
  /YOUR_[A-Z_]+_HERE/i,
  /your_[a-z_]+_here/i,
  /changeme/i,
  /replace[_-]?me/i,
  /<.*>/, // e.g.  <your-key-here>
];

function isPlaceholder(value) {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed));
}

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

/**
 * Validate all environment variables and return a report object.
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export const validateEnv = () => {
  const errors = [];
  const warnings = [];

  const isProd = ENV.NODE_ENV === "production";

  // 1) Always-required checks
  for (const key of ALWAYS_REQUIRED) {
    if (isEmpty(ENV[key])) {
      errors.push(`${key} is missing (required in all environments).`);
    } else if (isPlaceholder(ENV[key])) {
      errors.push(`${key} is a placeholder — set a real value.`);
    }
  }

  // 2) Production-only checks
  if (isProd) {
    for (const key of PROD_REQUIRED) {
      if (isEmpty(ENV[key])) {
        errors.push(`${key} is missing (required in production).`);
      } else if (isPlaceholder(ENV[key])) {
        errors.push(`${key} is a placeholder — set a real value in production.`);
      }
    }

    // Payment provider cross-checks
    if (ENV.PAYMENT_PROVIDER === "stripe") {
      for (const key of STRIPE_REQUIRED) {
        if (isEmpty(ENV[key])) {
          errors.push(`${key} is missing (required when PAYMENT_PROVIDER=stripe).`);
        }
      }
    } else if (ENV.PAYMENT_PROVIDER === "razorpay") {
      for (const key of RAZORPAY_REQUIRED) {
        if (isEmpty(ENV[key])) {
          errors.push(`${key} is missing (required when PAYMENT_PROVIDER=razorpay).`);
        }
      }
    } else if (!["none", ""].includes(ENV.PAYMENT_PROVIDER)) {
      errors.push(`PAYMENT_PROVIDER must be "none" | "stripe" | "razorpay" (got "${ENV.PAYMENT_PROVIDER}").`);
    }
  } else {
    // ── Development: warn about missing AI / service keys but stay bootable ──
    const DEV_WARN = [
      "GROQ_API_KEY",
      "GEMINI_API_KEY",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "ARCJET_KEY",
      "ARCJET_ENV",
      "PAYMENT_PROVIDER",
    ];
    for (const key of DEV_WARN) {
      if (isEmpty(ENV[key]) || isPlaceholder(ENV[key])) {
        warnings.push(`${key} is not set — feature will not work until configured.`);
      }
    }

    // TURN is OPTIONAL - calls still work STUN-only, but behind restrictive NATs
    // they may fail to connect. Warn in development only (never in production
    // where missing TURN is simply accepted as STUN-only).
    if (!ENV.TURN_URL || !ENV.TURN_USERNAME || !ENV.TURN_CREDENTIAL) {
      warnings.push(
        "TURN_URL / TURN_USERNAME / TURN_CREDENTIAL not set - WebRTC will use STUN-only (calls may fail behind restrictive NATs)."
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
};

/**
 * Print a human-readable validation report (no secret values).
 */
export const printValidationReport = () => {
  const { ok, errors, warnings } = validateEnv();

  if (warnings.length > 0 && ENV.NODE_ENV !== "production") {
    console.warn("[ENV] Development warnings:");
    warnings.forEach((w) => console.warn(`  ⚠   ${w}`));
  }

  if (errors.length > 0) {
    console.error("[ENV] ❌ Configuration errors detected:");
    errors.forEach((e) => console.error(`  ✗  ${e}`));
    if (ENV.NODE_ENV === "production") {
      console.error("\n[ENV] Server cannot start in production with missing secrets.");
      console.error("[ENV] Copy backend/.env.example → backend/.env and set the required variables.\n");
      process.exit(1);
    } else {
      console.warn("[ENV] Continuing in development mode despite warnings.\n");
    }
  } else {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ENV] ✓ All required environment variables validated.");
    }
  }
};
