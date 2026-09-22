import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, FileIcon, MicIcon, PinIcon, SparklesIcon, XIcon, BarChart3Icon, LockIcon, StarIcon } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import SharedPhotosPanel from "./panels/SharedPhotosPanel";
import FilesPanel from "./panels/FilesPanel";
import VoiceNotesPanel from "./panels/VoiceNotesPanel";
import PinnedMessagesPanel from "./panels/PinnedMessagesPanel";
import AISummaryPanel from "./panels/AISummaryPanel";
import ChatAnalyticsPanel from "./panels/ChatAnalyticsPanel";
import StarredMessagesPanel from "./panels/StarredMessagesPanel";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

const widgets = [
  { key: "photos", icon: ImageIcon, label: "Photos", accent: "text-[color:var(--accent-3)]" },
  { key: "files", icon: FileIcon, label: "Files", accent: "text-[color:var(--accent-2)]" },
  { key: "voice", icon: MicIcon, label: "Voice", accent: "text-emerald-400" },
  { key: "pinned", icon: PinIcon, label: "Pinned", accent: "text-amber-400" },
  { key: "starred", icon: StarIcon, label: "Starred", accent: "text-amber-400" },
  { key: "ai", icon: SparklesIcon, label: "AI Summary", accent: "text-[color:var(--accent)]" },
  { key: "analytics", icon: BarChart3Icon, label: "Analytics", accent: "text-[color:var(--accent-2)]" },
];

function PremiumWidgets({ messages, isOpen, onClose, isLoading, error, onRetry, defaultPanel }) {
  const [activePanel, setActivePanel] = useState(defaultPanel === "photos" || defaultPanel === "files" || defaultPanel === "voice" || defaultPanel === "pinned" || defaultPanel === "starred" || defaultPanel === "ai" || defaultPanel === "analytics" ? defaultPanel : "widgets");
  const prevDefaultRef = useRef(defaultPanel);

  useEffect(() => {
    if (defaultPanel && defaultPanel !== prevDefaultRef.current) {
      setActivePanel(defaultPanel);
    }
    prevDefaultRef.current = defaultPanel;
  }, [defaultPanel]);

  useEffect(() => {
    if (!isOpen) {
      prevDefaultRef.current = null;
      setActivePanel("widgets");
    }
  }, [isOpen]);
  const isLocked = !canUsePremiumFeature(PREMIUM_FEATURES.WIDGETS);

  const renderPanel = useMemo(() => {
    if (isLocked) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <LockIcon className="size-7 text-[color:var(--text-muted)]" />
          </div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">Advanced Widgets</p>
          <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
            Unlock AI Summary, Analytics, and advanced conversation widgets with Vyntra Pro.
          </p>
          <button
            type="button"
            onClick={() => promptUpgrade("Advanced Widgets are available with Vyntra Pro.", PREMIUM_FEATURES.WIDGETS)}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent-3)]/30 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--glow)]"
          >
            Upgrade to Pro
          </button>
        </div>
      );
    }

    const commonProps = { messages, isLoading: isLoading || false, error: error || null, onRetry };

    switch (activePanel) {
      case "widgets":
       return (
         <div className="py-1.5">
           <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">All Widgets</p>
           {widgets.map(({ key: k, icon: Icon, label, accent }) => (
             <button
               key={k}
               onClick={() => setActivePanel(k)}
               className="mb-1 flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
             >
               <Icon className={`size-4 ${accent}`} />
               <span className="text-xs font-medium text-[color:var(--text-primary)]">{label}</span>
             </button>
           ))}
         </div>
       );
     case "photos":
        return <SharedPhotosPanel {...commonProps} />;
      case "files":
        return <FilesPanel {...commonProps} />;
      case "voice":
        return <VoiceNotesPanel {...commonProps} />;
      case "pinned":
        return <PinnedMessagesPanel {...commonProps} />;
      case "starred":
        return <StarredMessagesPanel {...commonProps} />;
      case "ai":
        return <AISummaryPanel {...commonProps} />;
      case "analytics":
        return <ChatAnalyticsPanel {...commonProps} />;
      default:
        return null;
    }
  }, [activePanel, messages, isLoading, error, isLocked, onRetry]);

   return (
     <AnimatePresence initial={false}>
       {isOpen && (
         <motion.div
           id="chat-details-panel"
           initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 shrink-0 overflow-hidden border-b border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Details</p>
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              title="Close details"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Tab row */}
          {!isLocked && (
            <div className="scrollbar-thin mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
              {activePanel !== "widgets" && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePanel("widgets")}
                  className="group flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium backdrop-blur-xl transition-all duration-300 text-[color:var(--text-muted)] hover:border-white/20 hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  ← All Widgets
                </motion.button>
              )}
              {widgets.map(({ key, icon: Icon, label, accent }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActivePanel(key)}
                  className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-xl transition-all duration-300 ${
                    activePanel === key
                      ? "border-[color:var(--accent-3)]/50 bg-gradient-to-r from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/20 text-[color:var(--text-primary)] shadow-[0_0_15px_var(--glow)]"
                      : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:border-white/20 hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                  }`}
                >
                  <Icon className={`size-3.5 ${accent}`} />
                  {label}
                </motion.button>
              ))}
            </div>
          )}

          {/* Panel content */}
          <div className="max-h-[38vh] overflow-y-auto border-t border-white/10 px-4 py-3">
            {renderPanel}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PremiumWidgets;
