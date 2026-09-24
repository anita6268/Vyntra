import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { XIcon, CheckIcon, CrownIcon, SparklesIcon, HardDriveIcon, PaletteIcon, CalendarIcon, RefreshCwIcon, ChevronRightIcon, VideoIcon, ScanTextIcon, LanguagesIcon, Wand2Icon, CalendarDaysIcon, ZapIcon, BarChart3Icon, LayoutGridIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import usePremiumStore from "../store/usePremiumStore";
import { useAuthStore } from "../store/useAuthStore";
import { PREMIUM_FEATURES, getAllPremiumFeatures } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

const PRO_FEATURES = getAllPremiumFeatures();

const FREE_FEATURES = [
  { label: "Basic messaging", icon: SparklesIcon },
  { label: "Standard themes", icon: PaletteIcon },
  { label: "Standard storage", icon: HardDriveIcon },
];

function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

export default function PlanManagerModal({
  isOpen,
  onClose,
  onOpenSummary,
  onOpenTranslate,
  onOpenSmartReply,
  onOpenMeetingNotes,
  onOpenAdvancedAI,
  onOpenStorage,
  onOpenCalls,
  onOpenThemes,
  onOpenAnalytics,
  onOpenWidgets,
}) {
  const { billingCycle, currentPeriodEnd, checkingOut, setCheckingOut } = usePremiumStore();
  const activatePro = useAuthStore((s) => s.activatePro);
  const cancelSubscription = useAuthStore((state) => state.cancelSubscription);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (confirmCancel) setConfirmCancel(false);
        else onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, confirmCancel]);

  const isPro = usePremiumStore((s) => s.isPro);

  const featureActionMap = {
    [PREMIUM_FEATURES.AI_SUMMARIZE]: onOpenSummary,
    [PREMIUM_FEATURES.AI_TRANSLATE]: onOpenTranslate,
    [PREMIUM_FEATURES.AI_SMART_REPLY]: onOpenSmartReply,
    [PREMIUM_FEATURES.AI_MEETING_NOTES]: onOpenMeetingNotes,
    [PREMIUM_FEATURES.ADVANCED_AI]: onOpenAdvancedAI,
    [PREMIUM_FEATURES.STORAGE]: onOpenStorage,
    [PREMIUM_FEATURES.HD_CALLS]: onOpenCalls,
    [PREMIUM_FEATURES.THEMES]: onOpenThemes,
    [PREMIUM_FEATURES.ANALYTICS]: onOpenAnalytics,
    [PREMIUM_FEATURES.WIDGETS]: onOpenWidgets,
  };

  const FEATURE_DESCRIPTIONS = {
    [PREMIUM_FEATURES.THEMES]: "Exclusive Aurora, Cyber & Sunset themes",
    [PREMIUM_FEATURES.HD_CALLS]: "Crystal-clear voice & video calling",
    [PREMIUM_FEATURES.AI_SUMMARIZE]: "Turn conversations into smart summaries",
    [PREMIUM_FEATURES.AI_TRANSLATE]: "Translate messages into any language",
    [PREMIUM_FEATURES.AI_SMART_REPLY]: "One-tap intelligent replies",
    [PREMIUM_FEATURES.AI_MEETING_NOTES]: "Generate structured conversation notes",
    [PREMIUM_FEATURES.ADVANCED_AI]: "Rewrite, assist & ask AI anything",
    [PREMIUM_FEATURES.STORAGE]: "More space for photos, videos & files",
    [PREMIUM_FEATURES.ANALYTICS]: "Insights, streaks & activity",
    [PREMIUM_FEATURES.WIDGETS]: "Photos, Files, Voice, Pinned & Starred",
  };

  const handleFeatureClick = (featureId) => {
    if (!isPro) {
      promptUpgrade("Upgrade to Vyntra Pro to unlock this feature.", featureId);
      return;
    }
    const action = featureActionMap[featureId];
    if (!action) return;
    action();
  };

  const expiryLabel = useMemo(() => {
    if (!isPro) return null;
    const formatted = formatDate(currentPeriodEnd);
    if (!formatted) return "Active";
    const end = new Date(currentPeriodEnd).getTime();
    const now = Date.now();
    if (end < now) return "Expired";
    return `Renews ${formatted}`;
  }, [isPro, currentPeriodEnd]);

    const handleUpgrade = async () => {
    setCheckingOut(true);
    try {
      const res = await activatePro("monthly");
      if (res?.error) {
        toast.error(res?.message || "Couldn't activate Vyntra Pro.");
      } else {
        toast.success("Vyntra Pro activated!");
        onClose?.();
      }
    } catch {
      toast.error("Couldn't activate Vyntra Pro. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCancel = async () => {
    setConfirmCancel(true);
  };

  const handleConfirmCancel = async () => {
    setConfirmCancel(false);
    setCanceling(true);
    const res = await cancelSubscription();
    setCanceling(false);
    if (!res?.error) {
      toast("Subscription canceled.", { icon: "🙁" });
      onClose?.();
    } else {
      toast.error(res?.message || "Couldn't cancel subscription.");
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="plan-manager-main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.992 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* HEADER */}
            <div className="relative shrink-0 border-b border-white/10 px-5 py-4">
              <div className="absolute -top-6 -right-6 size-20 rounded-full bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/10 blur-2xl" />
                            <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--text-primary)]">Your Plan</h3>
                  <p className="text-xs text-[color:var(--text-muted)]">Manage your Vyntra subscription</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      <CheckIcon className="size-3" /> Pro Active
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close plan manager"
                onClick={onClose}
                className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>

            {/* PLANS */}
            <div className="shrink-0 overflow-y-auto p-4">
              <div className="space-y-3">
                {/* PRO PLAN */}
                <motion.div
                  layout
                  className="rounded-2xl border-2 border-[color:var(--accent-3)]/40 bg-gradient-to-br from-[color:var(--accent)]/10 to-[color:var(--accent-3)]/5 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CrownIcon className="size-5 text-[color:var(--accent-3)]" />
                      <span className="text-lg font-bold text-[color:var(--text-primary)]">Vyntra Pro</span>
                    </div>
                     <span className="rounded-full bg-[color:var(--accent-3)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent-3)]">
                       {isPro ? "ACTIVE" : "INACTIVE"}
                     </span>
                  </div>

                  {isPro && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5">
                        <CalendarIcon className="size-3" />
                        Billed {billingCycle === "yearly" ? "yearly" : "monthly"}
                      </span>
                      {expiryLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5">
                          <RefreshCwIcon className="size-3" />
                          {expiryLabel}
                        </span>
                      )}
                    </div>
                  )}

                   {!isPro && (
                     <div className="mb-3 text-xs text-[color:var(--text-muted)]">Premium plan — all features unlocked</div>
                   )}

                   <div className="flex items-center justify-between">
                     {isPro ? (
                       <>
                         <span className="text-[11px] text-[color:var(--text-muted)]">Subscription active</span>
                         <button
                           type="button"
                           onClick={handleCancel}
                           className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-rose-300/80 transition-colors hover:border-rose-500/30 hover:text-rose-300"
                         >
                           Deactivate Pro
                         </button>
                       </>
                     ) : (
                       <>
                         <span className="text-[11px] text-[color:var(--text-muted)]">Subscription inactive</span>
                         <button
                           type="button"
                           onClick={handleUpgrade}
                           className="rounded-lg border border-[color:var(--accent-3)]/30 bg-[color:var(--accent-3)]/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-3)] transition-colors hover:bg-[color:var(--accent-3)]/20"
                         >
                           Activate Pro
                         </button>
                       </>
                     )}
                   </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PRO_FEATURES.map((f) => {
                        const Icon = f.icon;
                        return (
                          <motion.button
                            key={f.id}
                            type="button"
                            onClick={() => handleFeatureClick(f.id)}
                            whileHover={{ y: -2, scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="group relative flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.05] cursor-pointer"
                            aria-label={`Open ${f.title}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/10 text-[color:var(--accent-3)]">
                                  <Icon className="size-4" />
                                </div>
                                <span className="text-xs font-semibold text-[color:var(--text-primary)]">{f.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-[color:var(--accent-3)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--accent-3)]">
                                  PRO
                                </span>
                                <ChevronRightIcon className="size-3.5 text-[color:var(--text-muted)] transition-transform duration-200 group-hover:translate-x-0.5" />
                              </div>
                            </div>
                            <p className="text-[11px] leading-4 text-[color:var(--text-muted)]">{FEATURE_DESCRIPTIONS[f.id] || ""}</p>
                          </motion.button>
                        );
                      })}
                    </div>
                </motion.div>

                {/* FREE PLAN */}
                <motion.div
                  layout
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="size-5 text-white/60" />
                      <span className="text-lg font-bold text-[color:var(--text-primary)]">Free Plan</span>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">
                      {isPro ? "AVAILABLE" : "ACTIVE"}
                    </span>
                  </div>
                  <div className="mb-3 text-xs text-[color:var(--text-muted)]">Basic messaging experience</div>
                  <div className="space-y-1.5">
                    {FREE_FEATURES.map((f) => {
                      const Icon = f.icon;
                      return (
                        <div key={f.label} className="flex items-center gap-2.5">
                          <CheckIcon className="size-3.5 text-emerald-400/60" />
                          <Icon className="size-3.5 text-[color:var(--text-muted)]" />
                          <span className="text-xs text-[color:var(--text-primary)]">{f.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* FOOTER / ACTIONS */}
            <div className="shrink-0 border-t border-white/10 p-4">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                <motion.button
                  type="button"
                  aria-label="Maybe later"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="order-2 sm:order-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-white/10"
                >
                  Maybe later
                </motion.button>

                {isPro ? (
                  <motion.button
                    type="button"
                    aria-label="Cancel Vyntra Pro subscription"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCancel}
                    className="order-1 sm:order-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-white/10"
                  >
                    Cancel Subscription
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                                        aria-label="Activate Vyntra Pro"
                    disabled={checkingOut}
                    whileHover={checkingOut ? undefined : { scale: 1.02 }}
                    whileTap={checkingOut ? undefined : { scale: 0.97 }}
                    onClick={handleUpgrade}
                    className="order-1 sm:order-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]/40 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                                        {checkingOut ? "Activating…" : "Activate Pro"}
                  </motion.button>
                )}
               </div>
             </div>
           </motion.div>
         </motion.div>
     )}
     {confirmCancel && (
      <motion.div
        key="plan-manager-confirm-cancel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
        onClick={() => setConfirmCancel(false)}
      >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-1/2 top-1/2 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
            >
              <h3 className="text-base font-bold text-[color:var(--text-primary)]">Cancel Vyntra Pro?</h3>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                You will be moved to the Free plan and Pro features will be locked. This action can be reversed by resubscribing.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setConfirmCancel(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10">
                  Keep Pro
                </button>
                <button onClick={handleConfirmCancel} disabled={canceling} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] transition-colors hover:bg-rose-600 disabled:opacity-60">
                  {canceling ? "Canceling…" : "Cancel Subscription"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
  </AnimatePresence>,
    document.body
  );
}
