import { useMemo } from "react";
import usePremiumStore from "../store/usePremiumStore";

/**
 * useSubscription — centralized subscription state hook.
 *
 * Returns the backend-verified Pro/free status from usePremiumStore, which is
 * kept in sync by App.jsx from /api/auth/check and /api/subscriptions/me.
 *
 * Prefer this over reading usePremiumStore or useAuthStore directly in
 * components — it prevents duplicate feature checks and keeps subscription
 * logic in one place.
 */
function useSubscription() {
  const state = usePremiumStore();

  return useMemo(
    () => ({
      isPro: state.isPro,
      plan: state.plan,
      billingCycle: state.billingCycle,
      subscriptionStatus: state.subscriptionStatus,
      currentPeriodEnd: state.currentPeriodEnd,
      demoMode: state.demoMode || false,
      gatewayStatus: state.gatewayStatus || null,
    }),
    [state.isPro, state.plan, state.billingCycle, state.subscriptionStatus, state.currentPeriodEnd, state.demoMode, state.gatewayStatus]
  );
}

export default useSubscription;
