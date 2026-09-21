import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import aiRoutes from "./routes/ai.route.js";
import aiHistoryRoutes from "./routes/aiHistory.route.js";
import userRoutes from "./routes/user.route.js";
import subscriptionRoutes from "./routes/subscription.route.js";
import groupRoutes from "./routes/group.route.js";
import callRoutes from "./routes/call.route.js";
import wallpaperRoutes from "./routes/wallpaper.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { validateApiKeys } from "./lib/ai.js";
import { corsOptions } from "./lib/cors.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { printValidationReport } from "./lib/validateEnv.js";
import { logStorageMode } from "./lib/uploadValidation.js";
import { app, server } from "./lib/socket.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 5000;

// ── Startup validation ────────────────────────────────────────────────────────
// 1) Comprehensive env validation — exits in production if required secrets are
//    missing. In development it warns but allows local iteration.
//    (dotenv is loaded in lib/env.js via "dotenv/config" — no values are ever
//    printed, only variable names and status.)
printValidationReport();

// 2) AI provider key diagnostics (Groq + Gemini presence check, never prints the
//    keys themselves).
  validateApiKeys();

  // 3) Media storage diagnostics — tells the operator up front whether uploads
  //    will hit Cloudinary, the development data-URL fallback, or 503.
  logStorageMode();

  // ── Middleware ────────────────────────────────────────────────────────────────
app.use(securityHeaders);              // CSP, HSTS, X-Frame-Options, etc.
app.use(express.json({ limit: "8mb" })); // req.body (base64 media needs more than binary)
app.use(cors(corsOptions));              // shared CORS config (identical to Socket.IO)
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/ai/history", aiHistoryRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/wallpapers", wallpaperRoutes);

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// ── Global error handler ───────────────────────────────────────────────────────
// Catches any unhandled exception / rejected promise and guarantees a JSON
// response so the Vite proxy never returns a raw 502/HTML for AI endpoints.
app.use((err, req, res, next) => {
  console.error("[SERVER] Unhandled error:", err?.message || err);
  const status = err?.statusCode || err?.status || 500;
  const safeCodes = new Set([
    "VALIDATION_ERROR",
    "PAYMENT_GATEWAY_NOT_CONFIGURED",
    "AI_PROVIDER_ERROR",
    "AI_PROVIDER_AUTH_FAILED",
    "AI_MODEL_NOT_FOUND",
    "AI_RATE_LIMITED",
    "AI_PROVIDER_FAILED",
    "MEDIA_STORAGE_UNAVAILABLE",
    "MEDIA_UPLOAD_FAILED",
    "MEDIA_VALIDATION_FAILED",
    "MESSAGE_EMPTY",
    "RECEIVER_NOT_FOUND",
    "USER_BLOCKED",
    "MESSAGE_SELF_SEND",
    "MESSAGE_DB_VALIDATION",
    "MESSAGE_DB_SAVE",
    "GROUP_NOT_FOUND",
    "NO_RECIPIENT",
    "MESSAGE_SEND_FAILED",
  ]);
  const message =
    status === 500
      ? "Internal server error."
      : safeCodes.has(err?.code)
        ? err?.message || "Request failed."
        : "Request failed.";
  res.status(status).json({
    success: false,
    code: err?.code || "INTERNAL_ERROR",
    message,
  });
});

server.listen(PORT, () => {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Server running on port: ${PORT}`);
    }
    connectDB();
  });
