/**
 * grant-demo-pro.mjs — SAFE, DEMO-ONLY Vyntra Pro activation (backend-only tool).
 *
 * WHY THIS EXISTS
 *   Real Pro activation happens only through the payment flow
 *   (POST /api/subscriptions/checkout → gateway → confirm). With
 *   PAYMENT_PROVIDER=none the confirm step is intentionally blocked in
 *   production (demo_mode_not_allowed_in_production) so nobody can self-grant
 *   Pro for free. This script lets the OPERATOR grant Pro to one explicitly
 *   allow-listed DEMO account for testing, without touching any payment code.
 *
 * SAFETY MODEL (fail-closed)
 *   1. There is NO HTTP endpoint here — nothing a normal user or attacker can
 *      call. It must be run by someone with server/shell access to the backend.
 *   2. The target email MUST be listed in the DEMO_PRO_EMAILS env var
 *      (comma-separated). Any other email — including real users' — is refused.
 *      With DEMO_PRO_EMAILS unset the script refuses to run at all.
 *   3. It writes the exact same subscription fields the REAL flow writes
 *      (plan/isPro/subscriptionStatus/subscriptionProvider/subscriptionId/
 *      currentPeriodEnd/autoRenew), using the existing demo-mode semantics:
 *      provider "none", currentPeriodEnd null (never lapses — same as the
 *      existing demo path in subscription.controller.js), autoRenew false.
 *      All normal Pro gates (themes, HD calls, AI, storage, analytics, …)
 *      keep working unchanged because they read the standard isPro state.
 *   4. The account is marked role:"test" (an existing User.role value that is
 *      already excluded from contacts/search/forward queries), so the demo
 *      account never pollutes real users' contact lists.
 *   5. Fully reversible: run with --revoke to return the account to free.
 *
 * USAGE
 *   # 1) Sign up the demo account once through the normal app (/signup)
 *   # 2) Allow-list it (Render env or shell):
 *   #      DEMO_PRO_EMAILS=demo@vyntra.app
 *   # 3) Grant / revoke:
 *   #      node backend/scripts/grant-demo-pro.mjs --email=demo@vyntra.app
 *   #      node backend/scripts/grant-demo-pro.mjs --email=demo@vyntra.app --revoke
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db.js";
import { ENV } from "../src/lib/env.js";
import User from "../src/models/User.js";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const emailArg = args.find((a) => a.startsWith("--email="));
const email = (emailArg ? emailArg.split("=")[1] : "").trim().toLowerCase();

const DEMO_ALLOWLIST = String(process.env.DEMO_PRO_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const fail = (msg) => {
  console.error(`\n[DEMO-PRO] ✗ ${msg}\n`);
  process.exit(2);
};

// ── Guard 1: email argument is required and must look like an email ──────────
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("Usage: node backend/scripts/grant-demo-pro.mjs --email=<demo email> [--revoke]");
}

// ── Guard 2: explicit demo allow-list (fail-closed) ──────────────────────────
// This is what makes the script safe: it can never be pointed at a normal
// user's account, only at accounts the operator explicitly designated.
if (DEMO_ALLOWLIST.length === 0) {
  fail(
    "DEMO_PRO_EMAILS is not set. Add the demo account email(s) to the backend " +
      "environment first, e.g.  DEMO_PRO_EMAILS=demo@vyntra.app  — the script " +
      "refuses to run without an explicit allow-list."
  );
}
if (!DEMO_ALLOWLIST.includes(email)) {
  fail(
    `"${email}" is not in DEMO_PRO_EMAILS. Only explicitly allow-listed demo ` +
      `accounts can be modified (allow-list: ${DEMO_ALLOWLIST.join(", ")}).`
  );
}

await connectDB();

// Exact match first, then a case-insensitive fallback (emails are stored
// exactly as typed at signup).
let user = await User.findOne({ email });
if (!user) {
  user = await User.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
}
if (!user) {
  await mongoose.disconnect();
  fail(
    `No account found for "${email}". Sign the demo account up once through ` +
      "the normal app (/signup), then run this script again."
  );
}

if (revoke) {
  // Return to the exact free-user state (mirror of cancelSubscription).
  user.plan = "free";
  user.isPro = false;
  user.subscriptionStatus = "inactive";
  user.subscriptionId = "";
  user.autoRenew = false;
  user.currentPeriodEnd = null;
  await user.save();
  console.info(`\n[DEMO-PRO] ✓ Revoked. "${user.email}" is back on the free plan.\n`);
} else {
  // Grant Pro using the SAME field semantics as the real subscription flow's
  // demo path (subscription.controller.js confirmSubscription):
  //   provider "none" (PAYMENT_PROVIDER=none), currentPeriodEnd null
  //   (isPeriodActive treats it as never lapsing), autoRenew false.
  // role:"test" marks this as a QA/demo record (existing model enum value).
  user.role = "test";
  user.plan = "pro";
  user.isPro = true;
  user.billingCycle = "monthly";
  user.subscriptionStatus = "active";
  user.subscriptionProvider = "none";
  user.subscriptionId = `demo-pro-${Date.now()}`;
  user.currentPeriodEnd = null;
  user.autoRenew = false;
  await user.save();
  console.info(
    `\n[DEMO-PRO] ✓ "${user.email}" is now Vyntra Pro (DEMO).` +
      `\n           role=${user.role} plan=${user.plan} isPro=${user.isPro}` +
      `\n           subscriptionStatus=${user.subscriptionStatus} provider=${user.subscriptionProvider}` +
      `\n           subscriptionId=${user.subscriptionId} currentPeriodEnd=null (never lapses) autoRenew=false` +
      `\n           Env check: NODE_ENV=${ENV.NODE_ENV} PAYMENT_PROVIDER=${ENV.PAYMENT_PROVIDER} (unchanged)` +
      `\n           Revert any time with:  node backend/scripts/grant-demo-pro.mjs --email=${user.email} --revoke\n`
  );
}

await mongoose.disconnect();
process.exit(0);
