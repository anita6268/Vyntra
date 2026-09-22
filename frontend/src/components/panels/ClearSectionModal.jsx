import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Trash2Icon, XIcon, Loader2Icon } from "lucide-react";

/**
 * Reusable "Clear all?" confirmation modal (Vyntra glassmorphism style).
 *
 * Usage:
 *   <ClearSectionModal
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await store.clearX(); }}
 *     title="Clear all?"
 *     description="This will remove all items from this section. This cannot be undone."
 *     confirmLabel="Clear All"
 *     contactName="Pinned"
 *   />
 */
function ClearSectionModal({ isOpen, onClose, onConfirm, title, description, confirmLabel }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) setBusy(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } catch {
      // keep modal open — errors are surfaced by the store via toast
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="clear-section-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[var(--z-modal,1600)] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 p-6 shadow-2xl backdrop-blur-2xl sm:rounded-[28px]"
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-rose-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-40 w-40 rounded-full bg-[color:var(--accent-3)]/10 blur-3xl" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              title="Close"
            >
              <XIcon className="size-4" />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-rose-500/20 to-orange-500/20 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
                <Trash2Icon className="size-7 text-rose-400" />
              </div>

              <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                {description || "This action cannot be undone."}
              </p>

              <div className="mt-5 flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
                  {confirmLabel || "Clear All"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ClearSectionModal;