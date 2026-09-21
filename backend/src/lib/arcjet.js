import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";

import { ENV } from "./env.js";

// Environment-aware protection mode:
// - Development: DRY_RUN — logs only, never blocks, so real browser/dev traffic is not misclassified as bots.
//   Arcjet recommends DRY_RUN while tuning bot rules.
// - Production: LIVE — actively blocks attacks and bots.
const isProduction = process.env.NODE_ENV === "production";
const protectionMode = isProduction ? "LIVE" : "DRY_RUN";

const aj = arcjet({
  key: ENV.ARCJET_KEY,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: protectionMode }),
    // Create a bot detection rule
    detectBot({
      mode: protectionMode, // "DRY_RUN" in dev (log only) | "LIVE" in prod (block)
      // Block all bots except the following
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        // Uncomment to allow these other common bot categories
        // See the full list at https://arcjet.com/bot-list
        //"CATEGORY:MONITOR", // Uptime monitoring services
        //"CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
      ],
    }),
    // Create a token bucket rate limit. Other algorithms are supported.
    slidingWindow({
      mode: protectionMode, // "DRY_RUN" in dev (log only) | "LIVE" in prod (block)
      max: 100,
      interval: 60,
    }),
  ],
});

export default aj;
