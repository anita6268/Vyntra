// ──────────────────────────────────────────────────────────────────────────────
// Security response headers middleware.
//
// Adds browser-level protections (no third-party dependency required):
//  • Strict-Transport-Security  — HTTPS enforcement (production only)
//  • Content-Security-Policy     — restricts script/style/image/frame sources
//  • X-Content-Type-Options      — prevents MIME-type sniffing
//  • X-Frame-Options             — clickjacking protection
//  • X-XSS-Protection            — legacy browser XSS filter (defence-in-depth)
//  • Referrer-Policy             — limits referrer leakage
//  • Cross-Origin-Opener-Policy  — process isolation
//  • Cross-Origin-Resource-Policy — restricts who can embed resources
// ──────────────────────────────────────────────────────────────────────────────
import { ENV } from "../lib/env.js";
import { CLIENT_URLS } from "../lib/cors.js";

const isProd = ENV.NODE_ENV === "production";

// Build connect-src dynamically so development (Vite + Socket.IO) and
// production (same-origin API) both work without unsafe CSP exceptions.
const clientOrigins = CLIENT_URLS.map((u) => `'${u}'`).join(" ");
const connectSrc = isProd ? "'self' ws: wss:" : `'self' ${clientOrigins} ws: wss:`;

// A pragmatic CSP for a SPA + API backend. Adjust over time.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Tailwind uses inline <style>
  "img-src 'self' data: https:", // avatars, Cloudinary, favicons
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

export const securityHeaders = (req, res, next) => {
  // HSTS — only meaningful over HTTPS (production behind a TLS terminator)
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");
  }

  // Content-Security-Policy
  res.setHeader("Content-Security-Policy", CSP_DIRECTIVES.join("; ") + ";");

  // Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Clickjacking protection
  res.setHeader("X-Frame-Options", "DENY");

  // Legacy XSS protection (mostly redundant in modern browsers but harmless)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Limit referrer info to same-origin only
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Isolate the browsing context
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  // Restrict who can embed resources
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Permissions-Policy — lock down powerful browser features we don't use
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );

  next();
};
