/**
 * payments.js — the EXACT payment-gateway integration point for Vyntra Pro.
 *
 * This module is the single seam where a real payment provider plugs in. It
 * reports honestly whether a provider is configured. When the operator sets
 * PAYMENT_PROVIDER + provider keys in backend/.env, checkout becomes live; until
 * then this package reports `configured: false` and the checkout flow stops
 * BEFORE charging or claiming success (we never fabricate a completed payment).
 *
 * All other subscription logic (DB state machine, cancellation, auth) lives in
 * `subscription.controller.js`. Only the "charge the card / create the provider
 * subscription" step lives here — exactly what is still missing.
 */
import { ENV } from "./env.js";

const normalizeProvider = (value) => {
  const v = String(value || "").trim().toLowerCase();
  return v === "stripe" || v === "razorpay" ? v : "none";
};

const provider = normalizeProvider(ENV.PAYMENT_PROVIDER);

// `none` means PAYMENT_PROVIDER=none: a local demo mode with no real gateway, no
// API keys, and no real charge. It is first-class and intentionally supported
// (see completeCheckoutWithGateway below). Checkout still routes through the
// backend, so Pro is never self-granted on the client.
const isDemo = provider === "none";

const isConfigured = provider === "stripe"
  ? Boolean(ENV.STRIPE_SECRET_KEY)
  : provider === "razorpay"
    ? Boolean(ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET)
    : false;

export const paymentGatewayStatus = {
  configured: isConfigured,
  // True when PAYMENT_PROVIDER=none (local demo). The UI/backend use this to
  // enable the no-payment "Demo Checkout" flow end-to-end.
  demo: isDemo,
  provider: isConfigured ? provider : null,
  // Next step for whoever connects the gateway:
  integrationPoint: "backend/src/lib/payments.js → completeCheckoutWithGateway()",
  pricing: {
    monthly: { amount: Number(ENV.VYNTRA_PRO_PRICE_MONTHLY || 499), currency: "INR" },
    yearly: { amount: Number(ENV.VYNTRA_PRO_PRICE_YEARLY || 4790), currency: "INR" },
  },
};

/**
 * completeCheckoutWithGateway — the single remaining integration point.
 *
 * Given an authenticated user and the chosen billing cycle, this should:
 *   - Stripe:  `stripe.checkout.sessions.create({ mode: "subscription", ... })`
 *              then return { url, checkoutSessionId } to redirect the client.
 *   - Razorpay: create an order via `razorpay.orders.create({ amount, currency,
 *              notes: { userId, billingCycle } })` and return the order to
 *              initialize the Razorpay checkout.js in the browser.
 *
 * IMPORTANT: This MUST NOT return a fake success. If no provider is configured,
 * it throws so the caller returns an honest 503 instead of activating Pro.
 *
 * @param {{ _id: string, email: string }} user  authenticated user
 * @param {"monthly"|"yearly"} billingCycle         plan chosen by the user
 * @returns {Promise<{ provider: string, redirectUrl: string, checkoutId: string }>}
 */
export async function completeCheckoutWithGateway(user, billingCycle) {
  // Demo / no-payment mode (PAYMENT_PROVIDER=none): there is no real provider to
  // charge. Return a demo checkout descriptor so the frontend can reveal the
  // local "Activate Vyntra Pro" step. This NEVER fabricates a payment - Pro is
  // granted later, in confirmSubscription, once the backend records it.
  if (isDemo) {
    return {
      provider: "none",
      redirectUrl: "",
      checkoutId: `demo-checkout-${Date.now()}`,
      demo: true,
      billingCycle,
    };
  }

  if (!isConfigured) {
    const err = new Error("No payment gateway configured.");
    err.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
    throw err;
  }

  if (provider === "stripe") {
    // ───────────────────────────────────────────────────────────────────────────
    // STRIPE INTEGRATION (drop-in)
    //   const stripe = (await import("stripe"))(ENV.STRIPE_SECRET_KEY);
    //   const priceId = billingCycle === "yearly" ? "<YEARLY_PRICE_ID>" : "<MONTHLY_PRICE_ID>";
    //   const session = await stripe.checkout.sessions.create({
    //     mode: "subscription",
    //     success_url: `${ENV.CLIENT_URL}/?stripe=success`,
    //     cancel_url: `${ENV.CLIENT_URL}/?stripe=cancelled`,
    //     client_reference_id: String(user._id),
    //     customer_email: user.email,
    //     line_items: [{ price: priceId, quantity: 1 }],
    //   });
    //   return { provider: "stripe", redirectUrl: session.url, checkoutId: session.id };
    // ───────────────────────────────────────────────────────────────────────────
    throw new Error("Stripe checkout is not wired yet. See lib/payments.js.");
  }

  if (provider === "razorpay") {
    // ───────────────────────────────────────────────────────────────────────────
    // RAZORPAY INTEGRATION (drop-in)
    //   const Razorpay = (await import("razorpay")).default;
    //   const razorpay = new Razorpay({
    //     key_id: ENV.RAZORPAY_KEY_ID,
    //     key_secret: ENV.RAZORPAY_KEY_SECRET,
    //   });
    //   const order = await razorpay.orders.create({
    //     amount: paymentGatewayStatus.pricing[billingCycle].amount, // paise
    //     currency: paymentGatewayStatus.pricing[billingCycle].currency,
    //     notes: { userId: String(user._id), billingCycle },
    //   });
    //   return { provider: "razorpay", redirectUrl: "", checkoutId: order.id };
    // ───────────────────────────────────────────────────────────────────────────
    throw new Error("Razorpay checkout is not wired yet. See lib/payments.js.");
  }

  throw new Error("Unknown payment provider.");
}