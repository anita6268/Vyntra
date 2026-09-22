/**
 * premiumFeatures — feature gating helper for Vyntra Pro.
 *
 * Pro status is VERIFIED by the backend: usePremiumStore is synced from the
 * authenticated user (`/api/auth/check`) whenever it changes, and localStorage
 * is never trusted to grant Pro. A free user stays locked out of Pro features
 * even if they tamper with browser storage.
 *
 * Usage:
 *   import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
 *
 *   if (!canUsePremiumFeature(PREMIUM_FEATURES.THEMES)) {
 *     // show upgrade modal
 *   }
 */
import { PaletteIcon, VideoIcon, ScanTextIcon, LanguagesIcon, Wand2Icon, CalendarDaysIcon, ZapIcon, HardDriveIcon, BarChart3Icon, LayoutGridIcon } from "lucide-react";
import usePremiumStore from "../store/usePremiumStore";

export const PREMIUM_FEATURES = Object.freeze({
  THEMES: "themes",
  HD_CALLS: "hd_calls",
  AI_SUMMARIZE: "ai_summarize",
  AI_TRANSLATE: "ai_translate",
  AI_SMART_REPLY: "ai_smart_reply",
  AI_MEETING_NOTES: "ai_meeting_notes",
  ADVANCED_AI: "advanced_ai",
  STORAGE: "storage",
  ANALYTICS: "analytics",
  WIDGETS: "widgets",
});

export const PREMIUM_FEATURE_META = Object.freeze({
  [PREMIUM_FEATURES.THEMES]: { title: "Premium Themes", icon: PaletteIcon },
  [PREMIUM_FEATURES.HD_CALLS]: { title: "HD Calls", icon: VideoIcon },
  [PREMIUM_FEATURES.AI_SUMMARIZE]: { title: "AI Summarize", icon: ScanTextIcon },
  [PREMIUM_FEATURES.AI_TRANSLATE]: { title: "AI Translate", icon: LanguagesIcon },
  [PREMIUM_FEATURES.AI_SMART_REPLY]: { title: "Smart Reply", icon: Wand2Icon },
  [PREMIUM_FEATURES.AI_MEETING_NOTES]: { title: "Meeting Notes", icon: CalendarDaysIcon },
  [PREMIUM_FEATURES.ADVANCED_AI]: { title: "Advanced AI", icon: ZapIcon },
  [PREMIUM_FEATURES.STORAGE]: { title: "100GB Storage", icon: HardDriveIcon },
  [PREMIUM_FEATURES.ANALYTICS]: { title: "Chat Analytics", icon: BarChart3Icon },
  [PREMIUM_FEATURES.WIDGETS]: { title: "Advanced Widgets", icon: LayoutGridIcon },
});

// Read the backend-synced status. The store is only ever flipped to Pro when
// the authenticated user's subscription is active (see usePremiumStore.syncFromAuth).
export function canUsePremiumFeature(featureId) {
  if (!usePremiumStore.getState().isPro) return false;
  if (!featureId) return true;
  return Object.values(PREMIUM_FEATURES).includes(featureId);
}

export function getPremiumStatus() {
  const state = usePremiumStore.getState();
  return {
    isPro: state.isPro,
    plan: state.plan,
    billingCycle: state.billingCycle,
    subscriptionStatus: state.subscriptionStatus,
    currentPeriodEnd: state.currentPeriodEnd || null,
    demoMode: state.demoMode || false,
    gateway: state.gatewayStatus || null,
  };
}

export function getAllPremiumFeatures() {
  return Object.entries(PREMIUM_FEATURE_META).map(([id, meta]) => ({ id, ...meta }));
}
