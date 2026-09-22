import { motion, AnimatePresence } from "framer-motion";
import { MicOffIcon, MicIcon, PhoneOffIcon } from "lucide-react";
import { useCallStore, toggleMute, endCall } from "../lib/callSocket";

function formatTime(total) {
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function CallBadge() {
  const { status, duration, isMuted, callType } = useCallStore();
  const isActive = status === "ringing" || status === "connecting" || status === "connected";

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -6 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[color:var(--panel-strong)]/90 py-1.5 pl-2.5 pr-1.5 shadow-xl backdrop-blur-xl"
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="whitespace-nowrap text-[11px] font-medium text-[color:var(--text-primary)]">
            {status === "connected"
              ? formatTime(duration)
              : status === "ringing"
              ? "Ringing…"
              : "Connecting…"}{" "}
            • {callType === "video" ? "Video" : "Voice"}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`rounded-full p-1.5 transition-colors ${
              isMuted
                ? "bg-amber-500/20 text-amber-400"
                : "text-[color:var(--text-muted)] hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOffIcon className="size-3.5" /> : <MicIcon className="size-3.5" />}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={endCall}
            className="rounded-full bg-rose-500/80 p-1.5 text-white transition-colors hover:bg-rose-500"
            title="End call"
          >
            <PhoneOffIcon className="size-3.5" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CallBadge;
