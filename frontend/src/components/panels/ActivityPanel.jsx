import { motion } from "framer-motion";
import { ActivityIcon, MessageCircleIcon, ImageIcon, MicIcon } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

function ActivityPanel({ messages }) {
  const { authUser } = useAuthStore();

  const activities = messages
    .slice(-8)
    .reverse()
    .map((m, i) => {
      const isSelf = m.senderId === authUser._id;
      return {
        id: m._id || i,
        type: m.image ? "photo" : "message",
        text: m.image ? "Shared a photo" : m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isSelf,
      };
    });

  if (activities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ActivityIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No activity yet</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">Your conversation activity will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="relative space-y-3 border-l border-white/10 pl-4">
        {activities.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative"
          >
            <span className="absolute -left-[21px] top-1 flex size-3 items-center justify-center rounded-full border-2 border-[color:var(--panel)] bg-[color:var(--accent-3)]" />
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-muted)]">
                {a.type === "photo" ? (
                  <ImageIcon className="size-3 text-[color:var(--accent-3)]" />
                ) : (
                  <MessageCircleIcon className="size-3 text-[color:var(--accent-3)]" />
                )}
                <span className="font-medium text-[color:var(--text-primary)]">{a.isSelf ? "You" : "Them"}</span>
                <span>• {a.time}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-[color:var(--text-primary)]">{a.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default ActivityPanel;
