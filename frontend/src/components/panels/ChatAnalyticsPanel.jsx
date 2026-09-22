import { motion } from "framer-motion";
import {
  MessageCircleIcon,
  ImageIcon,
  MicIcon,
  PinIcon,
  FlameIcon,
  CalendarIcon,
  BarChart3Icon,
  ActivityIcon,
  TrophyIcon,
  LockIcon,
  RefreshCwIcon,
  FileTextIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../../lib/premiumFeatures";
import { promptUpgrade } from "../../lib/premiumGating";

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatAnalyticsPanel({ messages, isLoading, error, onRetry }) {
  const { authUser } = useAuthStore();
  const isAllowed = canUsePremiumFeature(PREMIUM_FEATURES.ANALYTICS);

  const stats = useMemo(() => {
    const list = Array.isArray(messages) ? messages : [];
    const myId = String(authUser?._id);
    const self = list.filter((m) => String(m.senderId) === myId);
    const other = list.filter((m) => String(m.senderId) !== myId);
    const photos = list.filter((m) => m.image);
    const audio = list.filter((m) => m.audio);
    const files = list.filter((m) => m.fileUrl && !m.image);
    const media = [...photos, ...audio];

    const pinned = list.filter((m) => Array.isArray(m.pinnedBy) && m.pinnedBy.some((id) => String(id) === myId));
    const starred = list.filter((m) => Array.isArray(m.starredBy) && m.starredBy.some((id) => String(id) === myId));

    const activeDays = new Set(list.map((m) => new Date(m.createdAt).toDateString())).size;

    const dailyCounts = {};
    list.forEach((m) => {
      const key = new Date(m.createdAt).toDateString();
      dailyCounts[key] = (dailyCounts[key] || 0) + 1;
    });
    const sortedDaily = Object.entries(dailyCounts)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-14);
    const maxDaily = Math.max(1, ...sortedDaily.map(([, c]) => c));

    const reactionCounts = {};
    list.forEach((m) => {
      if (Array.isArray(m.reactions)) {
        m.reactions.forEach((r) => {
          if (r?.emoji) {
            reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
          }
        });
      }
    });
    const topReaction = Object.entries(reactionCounts).sort((a, b) => b[1] - a[1])[0];

    const dayCounts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    list.forEach((m) => {
      const d = new Date(m.createdAt).getDay();
      dayCounts[Object.keys(dayCounts)[d]]++;
    });
    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total: list.length,
      sentByMe: self.length,
      received: other.length,
      mediaCount: media.length,
      photosCount: photos.length,
      audioCount: audio.length,
      filesCount: files.length,
      activeDays,
      dailyCounts: sortedDaily,
      maxDaily,
      topReaction: topReaction ? { emoji: topReaction[0], count: topReaction[1] } : null,
      pinnedCount: pinned.length,
      starredCount: starred.length,
      mostActiveDay: mostActiveDay ? { day: mostActiveDay[0], count: mostActiveDay[1] } : { day: "-", count: 0 },
    };
  }, [messages, authUser?._id]);

  const statCard = (icon, label, value, accent) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center transition-all duration-300 hover:bg-white/10">
      <div className={`mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 ${accent}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-[color:var(--text-primary)]">{value}</p>
      <p className="text-[10px] text-[color:var(--text-muted)]">{label}</p>
    </div>
  );

  if (!isAllowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LockIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">Chat Analytics</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Unlock conversation insights, activity charts, and streak tracking with Vyntra Pro.
        </p>
        <button
          type="button"
          onClick={() => promptUpgrade("Chat Analytics is available with Vyntra Pro.", PREMIUM_FEATURES.ANALYTICS)}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent-3)]/30 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--glow)]"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <BarChart3Icon className="size-5 animate-pulse text-[color:var(--accent-3)]" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <BarChart3Icon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load analytics</p>
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

  if (!messages || messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <BarChart3Icon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No analytics yet</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Start chatting to see conversation insights and activity trends.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_20px_var(--glow)]">
          <BarChart3Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Chat Analytics</p>
          <p className="text-[11px] text-[color:var(--text-muted)]">Conversation insights</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statCard(<MessageCircleIcon className="size-4" />, "Messages", stats.total, "text-[color:var(--accent-3)]")}
        {statCard(<ImageIcon className="size-4" />, "Photos", stats.photosCount, "text-[color:var(--accent-2)]")}
        {statCard(<MicIcon className="size-4" />, "Voice", stats.audioCount, "text-emerald-400")}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {statCard(<CalendarIcon className="size-4" />, "Active Days", stats.activeDays, "text-sky-400")}
        {statCard(<PinIcon className="size-4" />, "Pinned", stats.pinnedCount, "text-amber-400")}
        {statCard(<TrophyIcon className="size-4" />, "Starred", stats.starredCount, "text-amber-300")}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {statCard(<FileTextIcon className="size-4" />, "Files", stats.filesCount, "text-[color:var(--accent-2)]")}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[color:var(--text-primary)]">
          <ActivityIcon className="size-3.5 text-[color:var(--accent-3)]" />
          Send / Received
        </p>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.total ? (stats.sentByMe / stats.total) * 100 : 0}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)]"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.total ? (stats.received / stats.total) * 100 : 0}%` }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="h-full bg-[color:var(--accent-3)]"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[color:var(--text-muted)]">
          <span>You: {stats.sentByMe}</span>
          <span>Them: {stats.received}</span>
        </div>
      </div>

      {stats.dailyCounts.length > 1 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[color:var(--text-primary)]">
            <FlameIcon className="size-3.5 text-rose-400" />
            Response trend
          </p>
          <div className="flex h-16 items-end gap-[3px] sm:h-20">
            {stats.dailyCounts.map(([day, count]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-1 items-end justify-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / stats.maxDaily) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-[18px] rounded-t-sm bg-gradient-to-t from-[color:var(--accent)]/60 to-[color:var(--accent-3)]"
                    title={`${formatDateLabel(day)}: ${count} msg`}
                  />
                </div>
                <span className="truncate text-[9px] text-[color:var(--text-muted)] sm:text-[10px]">
                  {new Date(day).toLocaleDateString(undefined, { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.topReaction && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 to-[color:var(--accent-3)]/10 p-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_18px_var(--glow)]">
            <span className="text-lg">{stats.topReaction.emoji}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Top reaction</p>
            <p className="text-xs text-[color:var(--text-muted)]">
              {stats.topReaction.emoji} used {stats.topReaction.count} time{stats.topReaction.count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 to-[color:var(--accent-3)]/10 p-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_18px_var(--glow)]">
          <TrophyIcon className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{stats.mostActiveDay.day} is your most active day</p>
          <p className="text-xs text-[color:var(--text-muted)]">{stats.mostActiveDay.count} messages sent on this day</p>
        </div>
      </div>
    </div>
  );
}

export default ChatAnalyticsPanel;
