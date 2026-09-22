import { motion, AnimatePresence } from "framer-motion";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";

const STATUS_LABEL = {
  ringing: "Ringing…",
  connecting: "Connecting…",
  connected: "Connected",
  declined: "Call declined",
  rejected: "Call declined",
  busy: "Busy",
  offline: "User is offline",
  missed: "User is offline",
  ended: "Call ended",
  error: "Call unavailable",
};

function formatTime(total) {
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function VoiceCallOverlay({ isOpen, call, onEnd, onToggleMute }) {
  const remoteAudioRef = useRef(null);

  // Speaker/remote audio: feed the arriving remote media stream to <audio>.
  useEffect(() => {
    if (remoteAudioRef.current && call?.remoteStream) {
      remoteAudioRef.current.srcObject = call.remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [call?.remoteStream, isOpen]);

  const showControls = call?.status === "ringing" || call?.status === "connecting" || call?.status === "connected";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="fixed bottom-6 right-6 z-[var(--z-popover,1700)] flex items-center gap-3 rounded-[22px] border border-white/10 bg-[color:var(--panel-strong)]/95 p-3 pr-4 shadow-2xl backdrop-blur-2xl"
        >
          <audio ref={remoteAudioRef} autoPlay playsInline />

          <div className="relative shrink-0">
            {call?.status === "connected" && (
              <span className="absolute right-0 top-0 flex size-3">
                <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
              </span>
            )}
            {call?.status !== "connected" && (
              <span className="absolute right-0 top-0 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
            )}
            <div className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]">
              <img
                src={call?.peer?.profilePic || "/avatar.png"}
                alt={call?.peer?.fullName || "Contact"}
                className="size-full rounded-full object-cover"
              />
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {call?.peer?.fullName || "Contact"}
            </p>
            <p className="text-xs text-[color:var(--text-muted)]">
              {call?.status === "connected"
                ? formatTime(call?.duration || 0)
                : call?.status === "error"
                ? call?.errorMessage
                : STATUS_LABEL[call?.status] || "Voice call"}
            </p>
          </div>

          {showControls && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onToggleMute}
              className={`rounded-full p-2.5 transition-colors ${
                call?.isMuted
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-[color:var(--text-muted)] hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              }`}
              title={call?.isMuted ? "Unmute" : "Mute"}
            >
              {call?.isMuted ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
            </motion.button>
          )}

          <button
            type="button"
            onClick={onEnd}
            className="flex size-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30 transition-colors hover:bg-rose-600"
            title={showControls ? "End call" : "Close"}
          >
            <PhoneOffIcon className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VoiceCallOverlay;

