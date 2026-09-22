import { motion } from "framer-motion";
import { useMemo } from "react";

function AnimatedChatBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 3 + 1.5,
        delay: Math.random() * 6,
        duration: Math.random() * 5 + 3,
        color: ["#7C3AED", "#06B6D4", "#A855F7", "#22D3EE"][i % 4],
      })),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 4,
        duration: Math.random() * 3 + 2,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Aurora blobs — subtle, never overpowering */}
      <motion.div
        animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:var(--accent)]/15 blur-[120px]"
      />
      <motion.div
        animate={{ x: [0, -70, 40, 0], y: [0, 50, -30, 0], scale: [1, 1.08, 0.94, 1] }}
        transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-8%] right-[-6%] h-80 w-80 rounded-full bg-[color:var(--accent-3)]/14 blur-[130px]"
      />
      <motion.div
        animate={{ x: [0, 40, -40, 0], y: [0, -30, 40, 0], scale: [1, 1.12, 1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-[color:var(--accent-2)]/12 blur-[120px]"
      />

{/* Mesh gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_20%),radial-gradient(circle_at_80%_30%,rgba(167,139,250,0.06),transparent_18%),radial-gradient(circle_at_50%_80%,rgba(6,182,212,0.04),transparent_22%)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:28px_28px]" />

      {/* Twinkling stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            opacity: 0.2,
          }}
        />
      ))}

      {/* Floating particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            animation: `blob-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            opacity: 0.28,
          }}
        />
      ))}
    </div>
  );
}

export default AnimatedChatBackground;
