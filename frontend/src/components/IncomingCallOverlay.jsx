import { motion, AnimatePresence } from "framer-motion";
import { VideoIcon, PhoneIcon, PhoneOffIcon } from "lucide-react";

/**
 * Incoming Voice/Video Call UI. Shown when a live call:offer arrives over
 * Socket.io. Accepting acquires media + answers WebRTC; rejecting declines.
 */
function IncomingCallOverlay({ isOpen, call, onAccept, onReject }) {
  const type = call?.callType || "video";
  const userName = call?.peer?.fullName || "Contact";
  const avatar = call?.peer?.profilePic || "/avatar.png";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal,1600)] flex items-center justify-center bg-black/70 backdrop-blur-lg"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl"
            style={{ backgroundImage: `url(${avatar})` }}
          />

          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative z-10 flex w-[min(92vw,420px)] flex-col items-center overflow-hidden rounded-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 p-8 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xl">
              <VideoIcon className="size-3.5 text-emerald-400" />
              Incoming {type === "video" ? "Video" : "Voice"} Call
            </div>

            <div className="relative mb-4">
              <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--accent)]/30" />
              <div className="relative flex size-28 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[3px] shadow-[0_0_50px_var(--glow)]">
                <img src={avatar} alt={userName} className="size-full rounded-full object-cover" />
              </div>
            </div>

            <h3 className="text-xl font-semibold text-white">{userName}</h3>
            <p className="mt-2 text-sm text-white/60">is calling you…</p>

            <div className="mt-6 flex items-center gap-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onReject}
                className="flex flex-col items-center gap-2"
                title="Decline"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/40 transition hover:bg-rose-600">
                  <PhoneOffIcon className="size-6" />
                </span>
                <span className="text-xs text-white/70">Decline</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onAccept}
                className="flex flex-col items-center gap-2"
                title="Accept"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-600">
                  <PhoneIcon className="size-6" />
                </span>
                <span className="text-xs text-white/70">Accept</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IncomingCallOverlay;

