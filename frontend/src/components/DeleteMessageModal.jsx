import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Trash2Icon, XIcon, Loader2Icon, ShieldAlertIcon } from "lucide-react";

/**
 * Premium "Delete message" confirmation modal (Vyntra style).
 * - Receives the selected message via props (no global variables).
 * - Dark glassmorphism + teal/emerald glow, rounded corners, backdrop blur.
 * - Smooth Framer Motion scale + fade animation, centered (mobile bottom-sheet).
 * - Actions: [Delete for me] [Delete for everyone] [Cancel].
 * - Closes on backdrop click, Escape key, or after a successful deletion.
 * Only ONE instance is ever rendered by the parent (single deleteMsg state).
 */
function DeleteMessageModal({
  isOpen,
  message,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  canDeleteForEveryone,
}) {
  const [busy, setBusy] = useState(null); // null | "me" | "everyone"

  // Reset busy state whenever the modal closes.
  useEffect(() => {
    if (!isOpen) setBusy(null);
  }, [isOpen]);

  // Close on Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleDelete = async (scope) => {
    if (busy) return;
    setBusy(scope);
    const handler = scope === "everyone" ? onDeleteForEveryone : onDeleteForMe;
    try {
      const ok = await handler?.();
      // Only close after a successful deletion; errors are toasted by the store.
      if (ok) onClose();
    } catch {
      // keep modal open — failure already surfaced via toast
    } finally {
      setBusy(null);
    }
  };

  const isLoading = busy !== null;

  return createPortal(
    <AnimatePresence>
      {isOpen &&
        message && (
          <motion.div
            key="delete-message-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[var(--z-popover,1700)] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={onClose}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Delete message"
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 p-6 shadow-2xl backdrop-blur-2xl sm:rounded-[28px]"
            >
              {/* Ambient teal/emerald glow accents */}
              <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[color:var(--accent-3)]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                title="Close"
              >
                <XIcon className="size-4" />
              </button>

              <div className="relative flex flex-col items-center text-center">
                {/* Trash icon */}
                <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
                  <Trash2Icon className="size-7 text-[color:var(--accent-3)]" />
                </div>

                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                  Delete message?
                </h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Choose how you want to remove this message.
                </p>

                {/* Message preview */}
                {message && (
                  <div className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left">
                    {message.image ? (
                      <img
                        src={message.image}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-3)]/15 text-[color:var(--accent-3)]">
                        <Trash2Icon className="size-4" />
                      </div>
                    )}
                    <p className="min-w-0 truncate text-sm text-[color:var(--text-primary)]">
                      {message.text || (message.image ? "📷 Photo" : "Message")}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-5 flex w-full flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete("me")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_var(--glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === "me" ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4" />
                    )}
                    Delete for me
                  </button>

                  {canDeleteForEveryone && (
                    <button
                      type="button"
                      onClick={() => handleDelete("everyone")}
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.22)] transition hover:bg-rose-500/25 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === "everyone" ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <ShieldAlertIcon className="size-4" />
                      )}
                      Delete for everyone
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
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

export default DeleteMessageModal;

