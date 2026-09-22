import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function CustomSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const reposition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
  };

  useEffect(() => {
    if (!open) return;
    reposition();
    const onResize = () => reposition();
    // Capture-phase scroll covers scroll on any ancestor (incl. modal body).
    const onScroll = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label || label;
  const MENU_WIDTH = 160;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-[color:var(--text-primary)] backdrop-blur-xl transition-colors hover:bg-white/10 outline-none"
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-[color:var(--text-muted)]" />
      </button>

      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={panelRef}
              role="listbox"
              aria-label={label}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 26, mass: 0.5 }}
              style={{
                position: "fixed",
                top: pos.top,
                left: Math.min(pos.left, typeof window !== "undefined" ? window.innerWidth - MENU_WIDTH - 8 : pos.left),
                width: MENU_WIDTH,
              }}
              onMouseDown={(e) => e.preventDefault()}
               className="z-[var(--z-popover,1700)] overflow-hidden rounded-xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
            >
              <ul className="py-1">
                {options.map((o) => {
                  const isActive = value === o.value;
                  return (
                    <motion.li
                      key={o.value}
                      whileHover={{ background: "rgba(255,255,255,0.06)" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange?.(o.value);
                        setOpen(false);
                      }}
                      className={`flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-[11px] ${
                        isActive
                          ? "text-[color:var(--accent-3)]"
                          : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                      }`}
                    >
                      <span>{o.label}</span>
                      {isActive && <CheckIcon className="size-3" />}
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

export default CustomSelect;
