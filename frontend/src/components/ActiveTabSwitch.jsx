import { MessageCircleMore, Users, SparklesIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch({ onAI }) {
  const { activeTab, setActiveTab } = useChatStore();

  const setTab = (key) => {
    if (key === "ai") {
      onAI?.();
      return;
    }
    setActiveTab(key);
  };

  return (
    <div className="mx-3 mb-3 flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-[color:var(--panel-strong)]/60 p-1 backdrop-blur-xl" role="tablist" aria-label="Sidebar navigation">
      {[
        { key: "chats", label: "Chats", icon: MessageCircleMore },
        { key: "contacts", label: "Contacts", icon: Users },
        { key: "ai", label: "AI", icon: SparklesIcon },
      ].map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => setTab(key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[14px] px-2 py-2 text-sm font-medium transition-colors duration-300 ${
              isActive
                ? "text-white"
                : "text-[color:var(--text-muted)] hover:bg-white/[0.04] hover:text-[color:var(--text-primary)]"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-[14px] bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] shadow-lg shadow-[color:var(--glow)]/40"
              />
            )}
            <Icon
              className={`relative z-10 size-4 transition-transform duration-300 ${
                key === "ai" && isActive ? "ai-sparkle" : ""
              }`}
            />
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
export default ActiveTabSwitch;
