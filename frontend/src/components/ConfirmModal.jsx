import { motion } from "framer-motion";
import { XIcon } from "lucide-react";

function ConfirmModal({ isOpen, onClose, onConfirm, title, description, confirmLabel, confirmVariant, disabled }) {
  if (!isOpen) return null;

  const isDisabled = disabled === true;

  const variantClasses =
    confirmVariant === "danger"
      ? `text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] ${isDisabled ? "bg-rose-500/40 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"}`
      : `text-white ${isDisabled ? "opacity-60 cursor-not-allowed" : "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]"}`;

    const handleBackdropClick = () => {
    if (!isDisabled) onClose?.();
  };

  const handleCloseClick = () => {
    if (!isDisabled) onClose?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(92vw,22rem)] rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[color:var(--text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={handleCloseClick}
            className={`flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)] ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <XIcon className="size-4" />
          </button>
        </div>
        {description && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{description}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCloseClick}
            disabled={isDisabled}
            className={`rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-white/10 ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDisabled}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${variantClasses}`}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ConfirmModal;
