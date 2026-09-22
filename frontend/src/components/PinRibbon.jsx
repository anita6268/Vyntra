import { motion, AnimatePresence } from "framer-motion";
import { PinIcon, XIcon } from "lucide-react";

/**
 * Top ribbon listing pinned messages. Click to scroll to the original,
 * X to unpin. Styled as a premium floating glass pill (labeled PINNED +
 * per-message chips), animated, persists during the session.
 */
function PinRibbon({ messages = [], onFocus, onUnpin }) {
  if (!messages || messages.length === 0) return null;

  return (
    <AnimatePresence>
      {messages.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-[15] shrink-0 overflow-hidden px-4 pt-2.5"
        >
          <div className="scrollbar-thin mx-auto flex max-w-3xl overflow-x-auto pb-2">
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-amber-400/25 bg-[color:var(--panel-strong)]/92 py-1.5 pl-1.5 pr-2 shadow-[0_10px_32px_rgba(0,0,0,0.42),0_0_24px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
              <span className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                <PinIcon className="size-3 shrink-0" />
                Pinned
              </span>
              {messages.slice(0, 5).map((msg) => (
                <div
                  key={msg._id}
                  className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1.5 transition-all duration-200 hover:border-amber-400/40 hover:bg-amber-400/10"
                  onClick={() => onFocus?.(msg._id)}
                  title="View pinned message"
                >
                  <span className="max-w-[140px] truncate text-[11px] text-[color:var(--text-primary)]">
                    {msg.image ? "📷 Photo" : msg.text}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin?.(msg._id);
                    }}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/20 hover:text-rose-400"
                    title="Unpin"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PinRibbon;
