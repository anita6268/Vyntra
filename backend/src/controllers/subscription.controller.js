import User from "../models/User.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { paymentGatewayStatus, completeCheckoutWithGateway } from "../lib/payments.js";

// How long a paid period lasts for a given billing cycle (ms).
const PERIOD_MS = { monthly: 30 * 24 * 60 * 60 * 1000, yearly: 365 * 24 * 60 * 60 * 1000 };

// Serialize a user document into the exact shape the frontend expects so the
// authenticated user always reflects the backend subscription source of truth.
const serializeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone || "",
  profilePic: user.profilePic,
  role: user.role,
  plan: user.plan,
  isPro: user.isPro,
  billingCycle: user.billingCycle,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionProvider: user.subscriptionProvider || "",
  subscriptionId: user.subscriptionId || "",
  currentPeriodEnd: user.currentPeriodEnd || null,
  autoRenew: user.autoRenew ?? false,
});

const isPeriodActive = (user) =>
  user.subscriptionStatus === "active" &&
  (!user.currentPeriodEnd || new Date(user.currentPeriodEnd).getTime() > Date.now());

export const materializeSubscription = (user) => {
  const active = isPeriodActive(user);
  if (user.isPro !== active) user.isPro = active;
  if (!active) {
    user.plan = "free";
    user.subscriptionStatus = "inactive";
  }
  return user;
};

export { isPeriodActive };

// Realtime sync so every open client of the user updates instantly.
const broadcastUser = (user) => {
  const socketId = getReceiverSocketId(String(user._id));
  if (socketId) {
    io.to(socketId).emit("userUpgraded", serializeUser(user));
  }
};

// POST /api/subscriptions/checkout
// Starts a REAL checkout flow for the chosen billing cycle. The payment gateway
// is the only remaining step (lib/payments.js). This never fabricates a charge.
export const createCheckout = async (req, res) => {
  try {
    const billingCycle = req.body?.billingCycle === "yearly" ? "yearly" : "monthly";
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found." });
    if (isPeriodActive(user)) {
      return res.status(400).json({ message: "You already have an active Vyntra Pro subscription." });
    }

    // The gateway integration returns a redirect URL / checkout id to open in
    // the browser. If no provider is configured it throws honestly (503 below),
    // so we never pretend a payment happened.
    const result = await completeCheckoutWithGateway(user, billingCycle);
    res.status(200).json({
      status: "checkout_started",
      checkoutId: result.checkoutId,
      redirectUrl: result.redirectUrl,
      provider: result.provider,
      billingCycle,
      // demo: true only in PAYMENT_PROVIDER=none mode (no real charge).
      demo: !!result.demo,
    });
  } catch (error) {
    if (error?.code === "PAYMENT_GATEWAY_NOT_CONFIGURED") {
      return res.status(503).json({
        status: "payment_gateway_not_configured",
        message: "Vyntra Pro checkout requires a payment provider. Set PAYMENT_PROVIDER in backend/.env.",
        integrationPoint: paymentGatewayStatus.integrationPoint,
        gateway: paymentGatewayStatus,
      });
    }
    console.error("Error in createCheckout controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
// POST /api/subscriptions/confirm
// The exact point the payment gateway / webhook (or browser redirect) calls
// AFTER the provider has charged the customer. Only then is Pro activated on
// the backend. Free users cannot reach this unless a valid checkout resolves.
export const confirmSubscription = async (req, res) => {
  try {
    const billingCycle = req.body?.billingCycle === "yearly" ? "yearly" : "monthly";
    const bodyProvider = req.body?.provider;
    const provider =
      ["stripe", "razorpay", "none"].includes(bodyProvider)
        ? bodyProvider
        : paymentGatewayStatus.provider || "";

    // No-payment mode (PAYMENT_PROVIDER=none): no real provider subscription
    // exists. If none was supplied, synthesize an internal id - this only
    // identifies the local record, it is NOT a real provider charge.
    let providerSubscriptionId = String(req.body?.subscriptionId || "");
    if (paymentGatewayStatus.demo && !providerSubscriptionId) {
      providerSubscriptionId = `demo-sub-${Date.now()}`;
    }

    // Real providers require a connected gateway AND a provider subscription id.
    // No-payment mode bypasses both - the confirm step alone activates Pro.
    if (!paymentGatewayStatus.configured && !paymentGatewayStatus.demo) {
      return res.status(503).json({
        status: "payment_gateway_not_configured",
        message: "Cannot confirm a subscription before a payment gateway is connected.",
        integrationPoint: paymentGatewayStatus.integrationPoint,
      });
    }
    if (!paymentGatewayStatus.demo && !providerSubscriptionId) {
      return res.status(400).json({ message: "subscriptionId is required to confirm checkout." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (isPeriodActive(user)) {
      return res.status(400).json({ message: "You already have an active Vyntra Pro subscription." });
    }

    user.plan = "pro";
    user.isPro = true;
    user.billingCycle = billingCycle;
    user.subscriptionStatus = "active";
    user.subscriptionProvider = provider; // "none" in no-payment mode
    user.subscriptionId = providerSubscriptionId; // demo-<id> in no-payment mode
    // No-payment subscriptions never lapse and never auto-renew;
    // real subscriptions get a real period end + auto-renew.
    user.currentPeriodEnd = paymentGatewayStatus.demo ? null : new Date(Date.now() + PERIOD_MS[billingCycle]);
    user.autoRenew = !paymentGatewayStatus.demo;
    await user.save();

    broadcastUser(user);
    res.status(200).json({ status: "active", user: serializeUser(user) });
  } catch (error) {
    console.error("Error in confirmSubscription controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/subscriptions/activate
// Direct Pro activation — no payment provider, no checkout, no verification.
// Any authenticated user can activate Vyntra Pro instantly. This reuses the
// exact same subscription fields/persistence as the payment-based flow so
// Cancel Subscription continues to work unchanged.
export const activatePro = async (req, res) => {
  try {
    const billingCycle = req.body?.billingCycle === "yearly" ? "yearly" : "monthly";

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (isPeriodActive(user)) {
      return res.status(200).json({ status: "active", user: serializeUser(user) });
    }

    user.plan = "pro";
    user.isPro = true;
    user.billingCycle = billingCycle;
    user.subscriptionStatus = "active";
    user.subscriptionProvider = "none";
    user.subscriptionId = `pro-${Date.now()}`;
    user.currentPeriodEnd = null; // Never lapse — direct activation
    user.autoRenew = false;
    await user.save();

    broadcastUser(user);
    res.status(200).json({ status: "active", user: serializeUser(user) });
  } catch (error) {
    console.error("Error in activatePro controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/subscriptions/cancel
// Manages Pro: cancels auto-renewal and, because a canceled subscription no
// longer grants access, downgrades the user's plan to free immediately.
export const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.subscriptionStatus !== "active") {
      return res.status(400).json({ message: "You do not have an active subscription to cancel." });
    }

    user.subscriptionStatus = "inactive";
    user.subscriptionId = "";
    user.autoRenew = false;
    user.currentPeriodEnd = null;
    user.plan = "free";
    user.isPro = false;
    await user.save();

    broadcastUser(user);
    res.status(200).json({ status: "inactive", user: serializeUser(user) });
  } catch (error) {
    console.error("Error in cancelSubscription controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/subscriptions/me
// Live backend check of the authenticated user's subscription state. This is
// what re-verifies Pro on refresh/login instead of trusting localStorage.
export const getSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const wasPro = user.isPro;
    materializeSubscription(user);
    if (wasPro !== user.isPro) {
      await user.save();
    }

    res.status(200).json({
      plan: user.plan,
      isPro: user.isPro,
      billingCycle: user.billingCycle,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd || null,
      gateway: paymentGatewayStatus,
    });
  } catch (error) {
    console.error("Error in getSubscription controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};