import { CheckIcon } from "lucide-react";
import toast from "react-hot-toast";
import usePremiumStore from "../store/usePremiumStore";

/**
 * Premium feature gating helper.
 *
 * For a FREE user attempting a premium-only action, show a polished prompt:
 *   "This feature is available with Vyntra Pro."  [Upgrade to Pro]
 *
 * Clicking "Upgrade to Pro" opens the centralized Vyntra Pro modal.
 *
 * PRO usage (inside event handlers):
 *   import { promptUpgrade } from "../lib/premiumGating";
 *   if (!canUsePremiumFeature(PREMIUM_FEATURES.THEMES)) return promptUpgrade("Premium themes are available with Vyntra Pro.", PREMIUM_FEATURES.THEMES);
 *
 * SINGLETON: Only ONE upgrade prompt can ever be visible at a time.
 * `promptUpgrade` is the single choke point for ALL Pro-gated features
 * (Translate, Grammar Fix, Smart Reply, themes, calls, widgets, ...). It
 * (1) early-returns if the centralized Vyntra Pro modal is already open
 *     (store.isUpgradeOpen), and (2) tags the toast with a stable `id` so
 *     react-hot-toast reuses/updates the existing prompt instead of stacking a
 *     duplicate when a feature is triggered rapidly several times. Future
 *     Pro-gated features MUST route through `promptUpgrade`.
 */
// Stable id so react-hot-toast REUSES this prompt instead of stacking duplicates
// when a premium feature is triggered multiple times in rapid succession (e.g.
// double-clicking the Translate / Grammar Fix / Smart Reply buttons). react-hot-toast
// updates an existing toast that shares an `id` rather than enqueueing a new one.
const UPGRADE_PROMPT_TOAST_ID = "vyntra-pro-upgrade-prompt";

export function promptUpgrade(message) {
   const store = usePremiumStore.getState();

   // The centralized Vyntra Pro modal is already open - do not stack a second
   // upgrade prompt on top of it. Uses the existing modal state as the single
   // source of truth so only one Pro prompt/modal can ever be visible at once.
   if (store.isUpgradeOpen) return;

   const displayMessage = message || "This feature is available with Vyntra Pro.";

  toast.custom((t) => (
    <div
      onClick={() => toast.dismiss(t.id)}
      className="pointer-events-auto w-[min(92vw,320px)] rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-4 shadow-2xl backdrop-blur-2xl"
      role="alertdialog"
      aria-label="Upgrade required"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
          <CheckIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Vyntra Pro</p>
          <p className="text-xs text-[color:var(--text-muted)]">{displayMessage}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          store.openUpgradeModal();
        }}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]"
      >
        Upgrade to Pro
      </button>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
      >
        Maybe later
      </button>
    </div>
  ), { id: UPGRADE_PROMPT_TOAST_ID, duration: 6000 });
}
