import { motion } from "framer-motion";
import { SparklesIcon, StarIcon, UsersIcon, FolderIcon, PhoneIcon, HistoryIcon, PinIcon, ZapIcon, CrownIcon } from "lucide-react";
import usePremiumStore from "../store/usePremiumStore";

const quickSections = [
  { key: "pinned", icon: PinIcon, label: "Pinned" },
  { key: "favorites", icon: StarIcon, label: "Favorites" },
  { key: "groups", icon: UsersIcon, label: "Groups" },
  { key: "files", icon: FolderIcon, label: "Files" },
  { key: "calls", icon: PhoneIcon, label: "Calls" },
  { key: "ai-history", icon: HistoryIcon, label: "AI History" },
];

function SidebarBottom({ activeQuick, onQuickSection, onUpgradeNow, onManagePlan }) {
  // Select each primitive independently. Returning an object literal from the
  // selector creates a new reference on every render, which makes
  // useSyncExternalStore's getSnapshot return a "new" value each time and
  // triggers an infinite re-render loop ("Maximum update depth exceeded").
  const isPro = usePremiumStore((state) => state.isPro);
  const plan = usePremiumStore((state) => state.plan);
  const isFree = plan !== "pro";
  const toggleQuick = (key) => {
    onQuickSection(activeQuick === key ? null : key);
  };

  return (
    <div className="border-t border-white/[0.08] p-2 space-y-2">
      {/* Compact premium quick-action tiles */}
      <div className="grid grid-cols-6 gap-1">
        {quickSections.map(({ icon: Icon, label, key }) => {
          const isActive = activeQuick === key;
          return (
            <motion.button
              key={key}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => toggleQuick(key)}
              aria-label={label}
              aria-pressed={isActive}
              className={`quick-tile cursor-pointer ${isActive ? "active" : ""}`}
            >
              <Icon className="size-3.5" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Vyntra Pro / Free Plan card */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => (isFree ? onUpgradeNow?.() : onManagePlan?.())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            isFree ? onUpgradeNow?.() : onManagePlan?.();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isFree ? "View Vyntra plans" : "Manage Vyntra Pro plan"}
        className="group relative cursor-pointer overflow-hidden rounded-[16px] border border-white/[0.08] transition-all duration-300 hover:border-white/15 hover:shadow-[0_0_14px_var(--glow)]/50"
        style={
          isFree
            ? { background: "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))" }
            : {
                background:
                  "linear-gradient(140deg, rgba(20,4,10,0.75), rgba(36,8,18,0.8)), radial-gradient(circle at 90% 20%, color-mix(in srgb, var(--accent-3) 14%, transparent), transparent 50%)",
              }
        }
      >
        <div className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-[color:var(--accent-3)]/10 blur-2xl transition-transform duration-300 group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-8 -left-4 size-16 rounded-full bg-[color:var(--accent)]/8 blur-xl" />
        <div className="relative p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            {isPro ? <CrownIcon className="size-3 text-yellow-300" /> : <ZapIcon className="size-3 text-[color:var(--accent-3)]" />}
            <span className="text-xs font-bold text-white">{isPro ? "Vyntra Pro" : "Free Plan"}</span>
            {isPro ? (
              <span className="shrink-0 rounded-full bg-[color:var(--accent-3)]/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[color:var(--accent)]">
                PRO
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/50">
                FREE
              </span>
            )}
          </div>
          <p className="mb-2 text-[11px] leading-4 text-[color:var(--text-muted)]">
            {isPro ? "Premium plan active" : "Basic messaging experience"}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              isFree ? onUpgradeNow?.() : onManagePlan?.();
            }}
            aria-label={isFree ? "View Vyntra plans" : "Manage plan"}
            className="block w-full rounded-lg bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-3 py-1.5 text-center text-xs font-bold text-white shadow-[0_0_10px_var(--glow)]/60 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg"
          >
            {isFree ? "View Plans" : "Manage Plan"}
          </button>
        </div>
      </motion.div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-[color:var(--text-muted)]">
        <SparklesIcon className="size-3 text-[color:var(--accent-3)]" />
        {isPro ? "Pro plan active" : "Free plan"}
      </div>
    </div>
  );
}

export default SidebarBottom;
