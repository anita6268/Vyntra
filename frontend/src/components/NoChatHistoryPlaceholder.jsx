import { motion } from "framer-motion";
import { MessageCircleIcon, MicIcon, ImageIcon, SmileIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name }) => {
  // Floating decorative elements for the animated illustration
  const floaters = [
    { icon: SmileIcon, className: "left-6 top-4 text-[color:var(--accent-3)]", delay: 0, dur: 3.2 },
    { icon: ImageIcon, className: "right-8 top-10 text-[color:var(--accent)]", delay: 0.6, dur: 3.8 },
    { icon: MicIcon, className: "left-10 bottom-8 text-[color:var(--accent-2)]", delay: 1.1, dur: 3.4 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-h-0 w-full flex items-center justify-center"
    >
      <div className="flex flex-col items-center justify-center text-center px-6">
      {/* Animated illustration */}
      <div className="relative mb-6 flex h-40 w-40 items-center justify-center">
        {/* Glow ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-[color:var(--accent-3)]/40"
        />
        {/* Orbit ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          className="absolute inset-3 rounded-full border border-[color:var(--accent)]/30"
        />
        {/* Pulsing core */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 20px var(--glow)", "0 0 45px var(--glow)", "0 0 20px var(--glow)"] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative flex size-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25"
        >
          <MessageCircleIcon className="size-9 text-[color:var(--accent-3)]" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[color:var(--accent-3)] text-white">
            <SmileIcon className="size-3" />
          </span>
        </motion.div>

        {/* Floating icons */}
        {floaters.map(({ icon: Icon, className, delay, dur }, i) => (
          <motion.div
            key={i}
            animate={{ y: [-6, 8, -6], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: dur, repeat: Infinity, delay }}
            className={`absolute ${className}`}
          >
            <Icon className="size-5" />
          </motion.div>
        ))}
      </div>

      <h3 className="mb-3 text-lg font-semibold text-[color:var(--text-primary)]">Start a conversation with {name}</h3>
      <p className="mb-5 max-w-md text-sm text-[color:var(--text-muted)]">
        No messages yet. This is the beginning of your conversation — send a message to get started.
      </p>
      </div>
    </motion.div>
  );
};

export default NoChatHistoryPlaceholder;
