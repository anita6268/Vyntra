import { motion, AnimatePresence } from "framer-motion";
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PhoneOffIcon } from "lucide-react";
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

function VideoCallOverlay({ isOpen, call, onEnd, onToggleMute, onToggleCamera }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && call?.localStream) {
      localVideoRef.current.srcObject = call.localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [call?.localStream, call?.isCameraOff, isOpen]);

  useEffect(() => {
    if (remoteVideoRef.current && call?.remoteStream) {
      remoteVideoRef.current.srcObject = call.remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [call?.remoteStream, isOpen]);

  const showControls =
    call?.status === "ringing" || call?.status === "connecting" || call?.status === "connected";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal,1600)] flex items-center justify-center bg-black/85 backdrop-blur-lg"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl"
            style={{ backgroundImage: `url(${call?.peer?.profilePic || "/avatar.png"})` }}
          />

          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-4">
            {/* Remote (peer) video fills the screen; fallback to avatar while idle */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {!call?.remoteStream && (
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--accent)]/30" />
                  <div className="relative flex size-28 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[3px] shadow-[0_0_50px_var(--glow)]">
                    <img
                      src={call?.peer?.profilePic || "/avatar.png"}
                      alt={call?.peer?.fullName || ""}
                      className="size-full rounded-full object-cover"
                    />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white">{call?.peer?.fullName}</h3>
                <p className="mt-2 text-sm text-white/70">
                  {call?.status === "connected"
                    ? formatTime(call?.duration || 0)
                    : call?.status === "error"
                    ? call?.errorMessage
                    : STATUS_LABEL[call?.status] || "Video call"}
                </p>
              </div>
            )}

            {/* Local (self) picture-in-picture */}
            {call?.localStream && (
              <div className="absolute right-4 top-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/20 bg-black/50 shadow-2xl sm:h-48 sm:w-36">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${call?.isCameraOff ? "opacity-0" : ""}`}
                />
                {call?.isCameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white/70">
                    <VideoOffIcon className="size-8" />
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-6 z-20 flex items-center gap-3 rounded-full border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-xl">
              {showControls && (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={onToggleCamera}
                    className={`flex size-11 items-center justify-center rounded-full transition-colors ${
                      call?.isCameraOff
                        ? "bg-white/15 text-white"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                    title={call?.isCameraOff ? "Turn camera on" : "Turn camera off"}
                  >
                    {call?.isCameraOff ? <VideoOffIcon className="size-5" /> : <VideoIcon className="size-5" />}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={onToggleMute}
                    className={`flex size-11 items-center justify-center rounded-full transition-colors ${
                      call?.isMuted ? "bg-amber-500/70 text-white" : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                    title={call?.isMuted ? "Unmute" : "Mute"}
                  >
                    {call?.isMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
                  </motion.button>
                </>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onEnd}
                className="flex size-11 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/40 hover:bg-rose-600"
                title={showControls ? "End call" : "Close"}
              >
                <PhoneOffIcon className="size-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VideoCallOverlay;

