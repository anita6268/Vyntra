import { ENV } from "./env.js";

// Development origins allowed during development
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

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
  const set = new Set(parseClientUrls());
  if (ENV.NODE_ENV !== "production") {
    DEV_ORIGINS.forEach((o) => set.add(o));
  }
  return Array.from(set);
}

// Shared list of allowed origins, used by both Express and Socket.IO
export const CLIENT_URLS = buildAllowedOrigins();

// Shared CORS options object
export const corsOptions = {
  origin: CLIENT_URLS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
