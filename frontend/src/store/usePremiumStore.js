import { create } from "zustand";

const PLAN_VALUES = ["free", "pro"];

/**
 * usePremiumStore — transient UI + a mirror of the *backend-verified* plan.
 *
 * The source of truth for Pro/free is the authenticated user (authUser) loaded
 * from the backend (`/api/auth/check`). `syncFromAuth()` reflects that onto
 * this store so existing components keep working. localStorage is NEVER trusted
 * to grant Pro — a user can only become Pro when the backend confirms an active
 * subscription after a real checkout.
 */
const usePremiumStore = create((set) => ({
  // Mirrors of the backend user's subscription (set via syncFromAuth).
  isPro: false,
  plan: "free",
  billingCycle: "monthly",
  subscriptionStatus: "inactive",
  currentPeriodEnd: null,

  // Demo / gateway state (set via syncFromSubscription or syncFromAuth).
  demoMode: false,
  gatewayStatus: null,
  subscriptionError: null,

  // Transient UI state (not persisted; never a source of truth).
  isUpgradeOpen: false,
  isPlanOpen: false,
  checkingOut: false,

  setBillingCycle: (cycle) =>
    set({ billingCycle: cycle === "monthly" ? "monthly" : "yearly" }),

  /**
   * Sync this store from the backend-authenticated user. Called whenever the
   * auth user changes (login, signup, checkAuth/refresh, payment success,
   * cancel, logout). This guarantees logout/login and refresh keep the correct
   * status because it always re-derives from the backend.
   */
  syncFromAuth: (user) => {
    if (!user) {
      return set({
        isPro: false,
        plan: "free",
        billingCycle: "monthly",
        subscriptionStatus: "inactive",
        currentPeriodEnd: null,
        demoMode: false,
        gatewayStatus: null,
        subscriptionError: null,
      });
    }
    const plan = ["free", "pro"].includes(user.plan) ? user.plan : "free";
    const status = user.subscriptionStatus === "active" ? "active" : "inactive";
    const periodEnd = user.currentPeriodEnd || null;
    const periodValid = !periodEnd || new Date(periodEnd).getTime() > Date.now();
    set({
      isPro: plan === "pro" && status === "active" && periodValid,
      plan,
      billingCycle: user.billingCycle === "yearly" ? "yearly" : "monthly",
      subscriptionStatus: status,
      currentPeriodEnd: periodEnd,
      demoMode: false,
      gatewayStatus: null,
      subscriptionError: null,
    });
  },

  syncFromSubscription: (data) => {
    if (!data) return set({ demoMode: false, gatewayStatus: null, subscriptionError: null, isPro: false, plan: "free", subscriptionStatus: "inactive", currentPeriodEnd: null, billingCycle: "monthly" });
    const plan = ["free", "pro"].includes(data.plan) ? data.plan : "free";
    const status = data.subscriptionStatus === "active" ? "active" : "inactive";
    const periodEnd = data.currentPeriodEnd || null;
    const periodValid = !periodEnd || new Date(periodEnd).getTime() > Date.now();
    set({
      isPro: plan === "pro" && status === "active" && periodValid,
      plan,
      billingCycle: data.billingCycle === "yearly" ? "yearly" : "monthly",
      subscriptionStatus: status,
      currentPeriodEnd: periodEnd,
      demoMode: Boolean(data.gateway?.demo),
      gatewayStatus: data.gateway || null,
      subscriptionError: null,
    });
  },

  setSubscriptionError: (error) => set({ subscriptionError: error || null }),

  setCheckingOut: (value) => set({ checkingOut: !!value }),

  openUpgradeModal: () => set({ isUpgradeOpen: true, isPlanOpen: false }),
  closeUpgradeModal: () => set({ isUpgradeOpen: false }),
  openPlanModal: () => set({ isPlanOpen: true, isUpgradeOpen: false }),
  closePlanModal: () => set({ isPlanOpen: false }),
}));

export default usePremiumStore;