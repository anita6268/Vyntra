import { ENV } from "./env.js";

// Development origins allowed during development
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

// Browsers send the Origin header already normalized: scheme and host are
// lowercase and there is never a trailing slash. Configured CLIENT_URL values
// frequently are not (e.g. "https://app.example.com/" with a trailing slash,
// stray whitespace or different case). The cors package compares with exact
// string equality — one mismatch and it silently omits
// Access-Control-Allow-Origin (while still sending the other CORS headers),
// which browsers report as "No 'Access-Control-Allow-Origin' header is
// present". Normalizing both sides keeps the allow-list semantics intact.
function normalizeOrigin(url) {
  return String(url || "").trim().replace(/\/+$/, "").toLowerCase();
}

// Parse CLIENT_URL which may be a single origin or a comma-separated list
function parseClientUrls() {
  const urls = [];
  if (ENV.CLIENT_URL) {
    const parts = ENV.CLIENT_URL.split(",").map((u) => u.trim()).filter(Boolean);
    urls.push(...parts);
  }
  return urls;
}

// In production, only the CLIENT_URL(s) from ENV are allowed.
// In development, we additionally allow the local dev origins.
function buildAllowedOrigins() {
  const set = new Set(parseClientUrls().map(normalizeOrigin));
  if (ENV.NODE_ENV !== "production") {
    DEV_ORIGINS.forEach((o) => set.add(normalizeOrigin(o)));
  }
  return Array.from(set);
}

// Shared list of allowed origins (normalized), used by both Express and Socket.IO
export const CLIENT_URLS = buildAllowedOrigins();

// Shared CORS options object.
// `origin` is a function so the incoming request Origin is compared
// slash/case-insensitively against the configured list; when allowed, the
// cors package reflects the exact request Origin (required for credentialed
// requests). Requests without an Origin header (curl, same-origin) pass.
export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    callback(null, CLIENT_URLS.includes(normalizeOrigin(origin)));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
