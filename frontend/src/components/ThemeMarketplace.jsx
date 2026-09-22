import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { XIcon, CheckIcon, PaletteIcon, SparklesIcon, LockIcon, CrownIcon } from "lucide-react";
import { THEMES, FREE_THEMES, PREMIUM_THEMES } from "../lib/themes";
import usePremiumStore from "../store/usePremiumStore";
import { PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

/**
 * Premium Theme Marketplace modal.
 * Shows all themes as animated preview cards; one tap to apply.
 * Persists via App's theme handler (localStorage + CSS vars).
 * Premium themes are locked for free users.
 */
function ThemeMarketplace({ isOpen, onClose, currentTheme, onApply }) {
  const isPro = usePremiumStore((s) => s.isPro);
  // Preview color palette per theme (for the card thumbnails).
  const previewColors = {
    dark: ["#09090b", "#7c3aed", "#06b6d4"],
    midnight: ["#020617", "#8b5cf6", "#22d3ee"],
    cyberpurple: ["#0a0418", "#a855f7", "#22d3ee"],
    emerald: ["#03140f", "#10b981", "#2dd4bf"],
    ocean: ["#04151f", "#0ea5e9", "#14b8a6"],
    crimson: ["#17040d", "#e11d48", "#fb923c"],
    sunset: ["#1c0a12", "#fb7185", "#fbbf24"],
    matrix: ["#020d05", "#22c55e", "#a3e635"],
    frost: ["#eef2f7", "#6366f1", "#06b6d4"],
    amoled: ["#000000", "#22d3ee", "#10b981"],
    discord: ["#1e2124", "#5865f2", "#43b581"],
    imessage: ["#f2f2f7", "#34c759", "#0a84ff"],
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
           className="fixed inset-0 z-[var(--z-modal,1600)] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl sm:rounded-[28px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
                  <PaletteIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Theme Marketplace</h3>
                  <p className="flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
                    <SparklesIcon className="size-3 text-[color:var(--accent-3)]" />
                    {FREE_THEMES.length} free · {PREMIUM_THEMES.length} premium
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="scrollbar-thin max-h-[65vh] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {THEMES.map((t) => {
                  const colors = previewColors[t.key] || ["#09090b", "#7c3aed", "#06b6d4"];
                  const isActive = currentTheme === t.key;
                  const isPremium = t.premium;
                  const isLocked = isPremium && !isPro;
                  return (
                    <motion.button
                      key={t.key}
                      whileHover={isLocked ? undefined : { scale: 1.02 }}
                      whileTap={isLocked ? undefined : { scale: 0.97 }}
                      onClick={() => {
                        if (isLocked) {
                          promptUpgrade("Premium themes are available with Vyntra Pro.", PREMIUM_FEATURES.THEMES);
                          return;
                        }
                        onApply?.(t.key);
                        onClose();
                      }}
                      className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                        isActive
                          ? "border-[color:var(--accent-3)] ring-2 ring-[color:var(--accent-3)]/40"
                          : isLocked
                            ? "border-white/5 opacity-80"
                            : "border-white/10 hover:border-white/25"
                      }`}
                      style={{ background: colors[0] }}
                    >
                      {/* Gradient preview swatch */}
                      <div
                        className="mb-2 h-14 w-full rounded-xl"
                        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})` }}
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: colors[2] }}>
                            {t.label}
                          </p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {t.key}
                          </p>
                        </div>
                        {isActive && (
                          <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--accent-3)] text-white">
                            <CheckIcon className="size-3.5" />
                          </span>
                        )}
                        {isPremium && !isActive && (
                          <span className="flex size-6 items-center justify-center rounded-full bg-white/15 text-white/90">
                            <CrownIcon className="size-3.5" />
                          </span>
                        )}
                      </div>
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[2px]">
                          <LockIcon className="size-6 text-white/90" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ThemeMarketplace;
