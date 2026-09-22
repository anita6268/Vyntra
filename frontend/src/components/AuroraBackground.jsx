import { motion } from "framer-motion";

function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-[#7C3AED]/30 blur-[110px]"
      />
      <motion.div
        animate={{ x: [0, -90, 0], y: [0, 60, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-8%] right-[-6%] h-80 w-80 rounded-full bg-[#06B6D4]/25 blur-[120px]"
      />
      <motion.div
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_20%),radial-gradient(circle_at_80%_30%,rgba(167,139,250,0.16),transparent_18%),radial-gradient(circle_at_50%_80%,rgba(6,182,212,0.12),transparent_22%)]"
      />
    </div>
  );
}

export default AuroraBackground;
