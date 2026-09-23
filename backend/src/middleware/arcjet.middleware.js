import aj from "../lib/arcjet.js";
import { isSpoofedBot } from "@arcjet/inspect";
import { ENV } from "../lib/env.js";

/**
 * Arcjet protection middleware (fail-open / resilient).
 *
 *  - ARCJET_KEY missing → skip protection, call next() so the app stays
 *    available without a valid key rather than blocking every request.
 *  - aj.protect() throws or times out (invalid/expired key, network issue,
 *    service outage) → log a warning and call next() (fail OPEN) so the
 *    request can still be served by downstream handlers.
 *  - Explicit Arcjet DENY decisions (bot, rate-limit, spoofed bot) are
 *    still enforced and return 403 / 429 as intended.
 */
export const arcjetProtection = async (req, res, next) => {
  // Fail open when Arcjet is not configured at all.
  if (!ENV.ARCJET_KEY) {
    return next();
  }

  try {
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
      } else if (decision.reason.isBot()) {
        return res.status(403).json({ message: "Bot access denied." });
      } else {
        return res.status(403).json({
          message: "Access denied by security policy.",
        });
      }
    }

    if (decision.results.some(isSpoofedBot)) {
      return res.status(403).json({
        error: "Spoofed bot detected",
        message: "Malicious bot activity detected.",
      });
    }

    next();
  } catch (error) {
    // protect() can throw or time out when the key is invalid/expired or
    // the Arcjet service is unreachable. Fail OPEN (warn + next) so
    // downstream handlers can still serve the request. Explicit DENY
    // decisions above are unaffected and still return 403 / 429.
    console.warn("Arcjet protect() failed — failing open:", error?.message || "Unknown error");
    next();
  }
};
