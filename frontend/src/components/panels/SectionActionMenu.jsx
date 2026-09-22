import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";

/**
 * Reusable 3-dot action menu for list items.
 * Renders a small vertical-ellipsis button that opens a compact dropdown
 * with the provided `actions` (each action: { label, icon, onClick, variant }).
 * Closes on outside click / Escape — no global state required.
 */
function SectionActionMenu({ actions = [], ariaLabel = "More actions" }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
      >
        <MoreVerticalIcon className="size-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[var(--z-popover,1700)]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 4 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="absolute right-0 top-full z-[var(--z-popover,1700)] mt-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-1 shadow-2xl backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {actions.map((action, idx) => {
                const Icon = action.icon || Trash2Icon;
                const isDanger = action.variant === "danger";
                return (
                  <button
                    key={action.key || idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      action.onClick?.(e);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      isDanger
                        ? "text-rose-300 hover:bg-rose-500/15"
                        : "text-[color:var(--text-primary)] hover:bg-white/10"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SectionActionMenu;