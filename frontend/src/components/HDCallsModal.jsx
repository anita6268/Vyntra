import { AnimatePresence, motion } from "framer-motion";
import { XIcon, PhoneIcon, VideoIcon, UserIcon, LockIcon } from "lucide-react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { startCall as startWebRTCCall } from "../lib/callSocket";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

function HDCallsModal({ isOpen, onClose }) {
  const selectedUser = useChatStore((s) => s.selectedUser);
  const isLocked = !canUsePremiumFeature(PREMIUM_FEATURES.HD_CALLS);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const startCall = (kind) => {
    if (!selectedUser) {
      toast("Pick a conversation first to start a call.", {
        icon: "📞",
        style: { borderRadius: "12px", background: "#1c1c22", color: "#fff" },
      });
      return;
    }
    startWebRTCCall(kind === "video" ? "video" : "voice", selectedUser);
  };

  const person = selectedUser?.fullName || null;
  const avatar = selectedUser?.profilePic || selectedUser?.image || null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="HD Calls"
            className="fixed inset-0 z-[105] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="flex w-full max-w-[480px] max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl">
              <div className="relative shrink-0 overflow-hidden rounded-t-3xl border-b border-white/10 bg-[linear-gradient(135deg,var(--accent),var(--accent-2),var(--accent-3))] px-6 py-7 text-center">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/20 blur-2xl" />
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-white/20 bg-white/15 mx-auto">
                  {isLocked ? <LockIcon className="size-6 text-white" /> : <PhoneIcon className="size-6 text-white" />}
                </div>
                <h2 className="mt-3 text-xl font-bold text-white">HD Calls</h2>
                <p className="text-xs text-white/85">{isLocked ? "Premium feature" : "High-quality voice & video"}</p>
                <button
                  onClick={onClose}
                  aria-label="Close HD calls"
                  className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {isLocked ? (
                <div className="flex-1 overflow-y-auto p-6 text-center">
                  <p className="text-sm text-[color:var(--text-muted)]">HD voice & video calls are available with Vyntra Pro.</p>
                  <button
                    type="button"
                    onClick={() => promptUpgrade("HD Calls are available with Vyntra Pro.", PREMIUM_FEATURES.HD_CALLS)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)]">
                      {avatar ? <img src={avatar} alt={person || ""} className="size-full object-cover" /> : <UserIcon className="size-5 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {person || "No conversation selected"}
                      </p>
                      <p className="text-[11px] text-[color:var(--text-muted)]">
                        {selectedUser ? "Ready to call" : "Open a chat to enable calling"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => startCall("voice")}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                        <PhoneIcon className="size-5" />
                      </span>
                      <span className="text-sm font-semibold text-[color:var(--text-primary)]">Voice Call</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">HD audio</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => startCall("video")}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-[color:var(--accent-3)]/40 hover:bg-[color:var(--accent)]/10"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-lg shadow-[color:var(--glow)]">
                        <VideoIcon className="size-5" />
                      </span>
                      <span className="text-sm font-semibold text-[color:var(--text-primary)]">Video Call</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">HD video</span>
                    </motion.button>
                  </div>

                  <p className="mt-4 text-center text-[10px] text-[color:var(--text-muted)]">
                    Starts a real-time call with the open conversation.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default HDCallsModal;
