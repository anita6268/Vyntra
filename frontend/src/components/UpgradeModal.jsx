import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  XIcon,
  SparklesIcon,
  BrainIcon,
  HardDriveIcon,
  VideoIcon,
  PaletteIcon,
  ZapIcon,
  CheckIcon,
  CrownIcon,
  LockIcon,
  Loader2Icon,
  AlertTriangleIcon,
  ServerIcon,
  BarChart3Icon,
  LanguagesIcon,
  Wand2Icon,
  CalendarDaysIcon,
  LayoutGridIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";
import usePremiumStore from "../store/usePremiumStore";
import { useAuthStore } from "../store/useAuthStore";
import { PREMIUM_FEATURES, getAllPremiumFeatures } from "../lib/premiumFeatures";

const AI_IDS = [PREMIUM_FEATURES.AI_SUMMARIZE, PREMIUM_FEATURES.AI_TRANSLATE, PREMIUM_FEATURES.AI_SMART_REPLY, PREMIUM_FEATURES.AI_MEETING_NOTES, PREMIUM_FEATURES.ADVANCED_AI];

const FEATURES = [
  { id: PREMIUM_FEATURES.AI_SUMMARIZE, title: "Unlimited AI", desc: "Summarize, translate, grammar fix, smart replies & Ask AI.", icon: BrainIcon },
  { id: PREMIUM_FEATURES.AI_TRANSLATE, title: "AI Translate", desc: "Translate messages into any language.", icon: LanguagesIcon },
  { id: PREMIUM_FEATURES.AI_SMART_REPLY, title: "Smart Reply", desc: "One-tap quick replies.", icon: Wand2Icon },
  { id: PREMIUM_FEATURES.AI_MEETING_NOTES, title: "Meeting Notes", desc: "Structured notes from your conversations.", icon: CalendarDaysIcon },
  { id: PREMIUM_FEATURES.ADVANCED_AI, title: "Advanced AI Features", desc: "Smart reply, rewrite & advanced assistance.", icon: ZapIcon },
  { id: PREMIUM_FEATURES.STORAGE, title: "100GB Storage", desc: "Plenty of space for photos, videos and files.", icon: HardDriveIcon },
  { id: PREMIUM_FEATURES.HD_CALLS, title: "HD Calls", desc: "Crystal-clear voice & video calls.", icon: VideoIcon },
  { id: PREMIUM_FEATURES.THEMES, title: "Premium Themes", desc: "Exclusive themes like Aurora, Cyber & Sunset.", icon: PaletteIcon },
  { id: PREMIUM_FEATURES.ANALYTICS, title: "Chat Analytics", desc: "Conversation insights, streaks, and activity charts.", icon: BarChart3Icon },
  { id: PREMIUM_FEATURES.WIDGETS, title: "Advanced Widgets", desc: "AI Summary, Analytics, Photos, Files, Voice, Pinned & Starred panels.", icon: LayoutGridIcon },
];

export default function UpgradeModal({
  isOpen, onClose, onOpenAI, onOpenStorage, onOpenCalls, onOpenThemes,
}) {
  const isPro = usePremiumStore((s) => s.isPro);
  const checkingOut = usePremiumStore((s) => s.checkingOut);
  const setCheckingOut = usePremiumStore((s) => s.setCheckingOut);
  const setBillingCycle = usePremiumStore((s) => s.setBillingCycle);
  const demoMode = usePremiumStore((s) => s.demoMode);
  const gatewayStatus = usePremiumStore((s) => s.gatewayStatus);
  const createCheckout = useAuthStore((s) => s.createCheckout);
  const confirmSubscription = useAuthStore((s) => s.confirmSubscription);
  const [billing, setBilling] = useState("monthly");
  const [step, setStep] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setBilling("monthly");
      setStep("idle");
      setErrorMsg("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const launcherFor = (id) => {
    if (AI_IDS.includes(id)) return onOpenAI;
    switch (id) {
      case PREMIUM_FEATURES.STORAGE: return onOpenStorage;
      case PREMIUM_FEATURES.HD_CALLS: return onOpenCalls;
      case PREMIUM_FEATURES.THEMES: return onOpenThemes;
      default: return null;
    }
  };

  const handleFeature = (id) => {
    if (!isPro) {
      toast("This feature is available with Vyntra Pro.", { icon: "✨" });
      return;
    }
    const launch = launcherFor(id);
    if (launch) {
      launch();
      onClose?.();
    }
  };

  const handleUpgrade = async () => {
    if (isPro || checkingOut || step === "loading") return;
    setStep("loading");
    setErrorMsg("");
    setCheckingOut(true);
    try {
      const res = await createCheckout(billing);

      if (res?.error) {
        if (res.status === 400 && /already have an active/i.test(res.message || "")) {
          setStep("active");
          setErrorMsg("Vyntra Pro is already active.");
          setCheckingOut(false);
          return;
        }
        setStep("error");
        setErrorMsg(res?.message || "Couldn't start checkout.");
        setCheckingOut(false);
        return;
      }

      if (res?.demo) {
        const confirmed = await confirmSubscription({ provider: "none", subscriptionId: res.checkoutId, billingCycle: res.billingCycle });
        if (confirmed?.error) {
          setStep("error");
          setErrorMsg(confirmed?.message || "Couldn't activate Vyntra Pro.");
        } else {
          setStep("success");
          toast.success("Vyntra Pro activated — welcome! (demo)");
        }
        setCheckingOut(false);
        return;
      }

      if (res?.redirectUrl) {
        window.location.assign(res.redirectUrl);
        return;
      }
      if (res?.status === "checkout_started") {
        toast("Checkout started — complete your payment with the provider.", { icon: "🔐" });
        setStep("idle");
        setCheckingOut(false);
        return;
      }

      setStep("error");
      setErrorMsg(res?.message || "Checkout is unavailable.");
      setCheckingOut(false);
    } catch {
      setStep("error");
      setErrorMsg("Couldn't start checkout. Please try again.");
      setCheckingOut(false);
    }
  };

  const isDemo = demoMode || gatewayStatus?.demo || !gatewayStatus?.configured;
  const isGatewayConfigured = gatewayStatus?.configured;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.992 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Vyntra Pro upgrade"
            className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* HEADER */}
            <div className="relative shrink-0 border-b border-white/10 px-5 py-4">
              <div className="absolute -top-8 -right-8 size-24 rounded-full bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/10 blur-2xl" />
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <CrownIcon className="size-6 text-[color:var(--accent-3)]" />
                <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Vyntra Pro</h3>
              </div>
              <p className="mt-0.5 text-center text-xs text-[color:var(--text-muted)] sm:text-left">
                Unlock the full Vyntra experience
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {isPro && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <CheckIcon className="size-3" /> Pro Active
                  </span>
                )}
                {isDemo && !isPro && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    <ServerIcon className="size-3" /> DEMO MODE
                  </span>
                )}
                {!isGatewayConfigured && !isDemo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                    <AlertTriangleIcon className="size-3" /> Gateway Not Configured
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-label="Close Vyntra Pro"
                onClick={onClose}
                className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* BODY (scrolls on short screens) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!isGatewayConfigured && !isDemo && (
                <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
                  <AlertTriangleIcon className="mx-auto mb-2 size-8 text-rose-400" />
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">Payment provider not configured</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    Set <code className="rounded bg-white/10 px-1 py-0.5 text-[color:var(--accent-3)]">PAYMENT_PROVIDER</code> in backend/.env to enable checkout.
                  </p>
                  <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                    Integration point: {gatewayStatus?.integrationPoint || "backend/src/lib/payments.js"}
                  </p>
                </div>
              )}

              {isDemo && !isPro && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <ServerIcon className="mx-auto mb-2 size-8 text-amber-300" />
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">DEMO MODE</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    Demo Mode — Payments are simulated for testing. Activating Pro here persists through the backend demo flow.
                  </p>
                </div>
              )}

              {/* BILLING-CYCLE TOGGLE */}
              <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
                {[
                  { key: "monthly", label: "Monthly" },
                  { key: "yearly", label: "Yearly", badge: "Save 20%" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={billing === opt.key}
                    onClick={() => { setBilling(opt.key); setBillingCycle(opt.key); }}
                    className={`relative flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                      billing === opt.key
                        ? "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-lg shadow-[color:var(--glow)]/30"
                        : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                    {opt.badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${billing === opt.key ? "bg-white/20 text-white" : "bg-[color:var(--accent-3)]/20 text-[color:var(--accent-3)]"}`}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* FEATURES */}
              <div className="space-y-2">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <motion.button
                      key={f.id}
                      type="button"
                      aria-label={f.title}
                      whileHover={{ x: 4, scale: 1.01 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleFeature(f.id)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/10 text-[color:var(--accent-3)]">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-[color:var(--text-primary)]">{f.title}</p>
                          {isPro ? (
                            <CheckIcon className="size-3 text-[color:var(--accent-3)]" />
                          ) : (
                            <LockIcon className="size-3 text-[color:var(--text-muted)]" />
                          )}
                        </div>
                        <p className="text-xs text-[color:var(--text-muted)]">{f.desc}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Feature comparison */}
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Plan comparison</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 text-xs font-bold text-[color:var(--text-muted)]">Free</p>
                    <ul className="space-y-1.5">
                      <li className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]"><CheckIcon className="size-3 text-emerald-400/60" /> Basic messaging</li>
                      <li className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]"><CheckIcon className="size-3 text-emerald-400/60" /> Standard themes</li>
                      <li className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]"><CheckIcon className="size-3 text-emerald-400/60" /> Standard storage</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--accent-3)]/30 bg-gradient-to-br from-[color:var(--accent)]/10 to-[color:var(--accent-3)]/5 p-3">
                    <p className="mb-2 text-xs font-bold text-[color:var(--accent-3)]">Pro</p>
                    <ul className="space-y-1.5">
                      {getAllPremiumFeatures().map((f) => (
                        <li key={f.id} className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-primary)]">
                          <CheckIcon className="size-3 text-[color:var(--accent-3)]" /> {f.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER / PRICE + CHECKOUT */}
            <div className="shrink-0 border-t border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/10 text-[color:var(--accent-3)]">
                  <CrownIcon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">Vyntra Pro</p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {billing === "yearly"
                      ? "Billed yearly — save 20%"
                      : "Billed monthly"}
                  </p>
                </div>
              </div>

                  {(step === "success" || step === "active" || isPro) && (
                 <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                   <CheckIcon className="mx-auto mb-2 size-8 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-300">{step === "active" && !isPro ? "Vyntra Pro is already active" : "Pro is now active"}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">All premium features are unlocked.</p>
                 </div>
               )}

              {step === "error" && (
                <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
                  <AlertTriangleIcon className="mx-auto mb-2 size-8 text-rose-400" />
                  <p className="text-sm font-semibold text-rose-300">{errorMsg || "Something went wrong"}</p>
                  <button
                    type="button"
                    onClick={() => setStep("idle")}
                    className="mt-2 text-xs font-medium text-[color:var(--accent-3)] transition hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

               <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                 {/* FREE state: dismiss with "Maybe later" or start activation */}
                 {!isPro && step !== "success" && step !== "error" && !(step === "loading" || checkingOut) && (
                   <>
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
                     <motion.button
                       type="button"
                       aria-label={isDemo ? "Activate Pro Demo" : "Start Vyntra Pro checkout"}
                       disabled={step === "loading" || step === "error"}
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.97 }}
                       onClick={handleUpgrade}
                       className="order-1 sm:order-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]/40 transition-shadow hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                     >
                       {isDemo ? (
                         <>Activate Pro Demo <SparklesIcon className="size-4" /></>
                       ) : (
                         <>Get Vyntra Pro <SparklesIcon className="size-4" /></>
                       )}
                     </motion.button>
                   </>
                 )}

                 {/* ACTIVATING state: loading only — no "Maybe later" */}
                 {(step === "loading" || checkingOut) && !isPro && step !== "success" && (
                   <motion.button
                     type="button"
                     aria-label="Activating Vyntra Pro"
                     disabled
                     className="order-1 sm:order-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]/40 disabled:cursor-not-allowed disabled:opacity-60"
                   >
                     <Loader2Icon className="size-4 animate-spin" /> Activating…
                   </motion.button>
                 )}

                 {/* ACTIVE state (after success or already Pro): confirm & close — no "Maybe later" */}
                 {(isPro || step === "success" || step === "active") && (
                   <motion.button
                     type="button"
                     aria-label="Continue to Vyntra"
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.97 }}
                     onClick={() => { setStep("idle"); setErrorMsg(""); onClose?.(); }}
                     className="order-1 sm:order-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]/40 transition-shadow hover:scale-[1.02]"
                   >
                     Continue <SparklesIcon className="size-4" />
                   </motion.button>
                 )}
               </div>

              {!isPro && (
                <p className="mt-2.5 flex items-center justify-center gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  {isDemo ? (
                    <>Demo mode — no payment required</>
                  ) : isGatewayConfigured ? (
                    <>Backend-driven checkout &bull; secure payment</>
                  ) : (
                    <>Connect Stripe/Razorpay to enable checkout</>
                  )}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}