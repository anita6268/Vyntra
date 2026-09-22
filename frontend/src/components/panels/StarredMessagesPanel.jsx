import { motion } from "framer-motion";
import { StarIcon, RefreshCwIcon } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

function StarredMessagesPanel({ messages, isLoading, error, onRetry }) {
  const { authUser } = useAuthStore();

  const starred = (messages || []).filter(
    (m) => Array.isArray(m.starredBy) && m.starredBy.some((id) => String(id) === String(authUser?._id))
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <StarIcon className="size-5 animate-pulse text-amber-400" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading starred messages…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <StarIcon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load starred messages</p>
        <p className="max-w-[200px] text-[10px] text-[color:var(--text-muted)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-[11px] font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25 disabled:opacity-50"
        >
          <RefreshCwIcon className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (starred.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <StarIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No starred messages</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Hover over a message and tap ⭐ in the action toolbar to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2">
        {starred.map((msg, i) => {
          const isSelf = String(msg.senderId) === String(authUser?._id);
          return (
            <motion.div
              key={msg._id || i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
                <StarIcon className="size-3" />
                {isSelf ? "You" : "Starred"}
              </div>
              <p className="text-sm text-[color:var(--text-primary)]">
                {msg.image ? "📷 Shared photo" : msg.audio ? "🎤 Voice message" : msg.fileUrl ? "📎 " + (msg.fileName || "File") : msg.text}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default StarredMessagesPanel;
