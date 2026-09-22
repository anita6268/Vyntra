import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  PinIcon,
  StarIcon,
  UsersIcon,
  FolderIcon,
  PhoneIcon,
  VideoIcon,
  HistoryIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  XIcon,
  BotIcon,
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupsPanel from "./GroupsPanel";
import SectionActionMenu from "./panels/SectionActionMenu";
import ClearSectionModal from "./panels/ClearSectionModal";

/**
 * QuickViewPanel — the slide-over panel opened from the sidebar quick-action
 * buttons (Pinned / Favorites / Groups / Files / Calls / AI History).
 *
 * For Pinned, Favorites and Files it fetches REAL data from
 * GET /api/messages/library (no fake data) and lets the user jump straight into
 * the conversation a message came from.
 *
 * Groups is fully wired (real-time group chats, member management, avatars).
 * Calls shows REAL persisted call history fetched from GET /api/calls (with an
 * honest empty state when there is none). AI History has no persistence yet, so
 * it shows a ready-to-use empty state that reuses the existing AI Assistant.
 */
const SECTIONS = {
  pinned: {
    icon: PinIcon,
    label: "Pinned",
    kind: "pinned",
    iconColor: "text-amber-300",
    empty: {
      icon: PinIcon,
      title: "No pinned messages",
      desc: "Hover over a message in any chat and tap 📌 to pin it here.",
    },
  },
  favorites: {
    icon: StarIcon,
    label: "Favorites",
    kind: "starred",
    iconColor: "text-amber-300",
    empty: {
      icon: StarIcon,
      title: "No starred messages",
      desc: "Hover over a message in any chat and tap ⭐ to save it here.",
    },
  },
    groups: {
    icon: UsersIcon,
    label: "Groups",
    kind: null,
  },
  files: {
    icon: FolderIcon,
    label: "Files",
    kind: "files",
    iconColor: "text-sky-300",
    empty: {
      icon: FileTextIcon,
      title: "No files shared",
      desc: "Files you send or receive in chats will appear here.",
    },
  },
  calls: {
    icon: PhoneIcon,
    label: "Calls",
    kind: null,
  },
  "ai-history": {
    icon: HistoryIcon,
    label: "AI History",
    kind: null,
  },
};

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(total) {
  const sec = Math.max(0, Math.round(total || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CALL_STATUS_LABEL = {
  completed: "Completed",
  missed: "Missed",
  rejected: "Declined",
  cancelled: "Cancelled",
};

function formatCallDate(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return time;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` · ${time}`;
  } catch {
    return "";
  }
}

const AI_FEATURE_LABELS = {
  translate: "Translate",
  grammar: "Grammar Fix",
  "reply-suggestion": "Reply Suggestion",
  "smart-reply": "Smart Reply",
  "meeting-notes": "Meeting Notes",
  chat: "AI Chat",
  summarize: "Summarize",
};

function formatAiHistoryDate(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return time;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` · ${time}`;
  } catch {
    return "";
  }
}

function messagePreview(m) {
  if (m.image) return "📷 Photo";
  if (m.audio) return "🎤 Voice message";
  if (m.fileUrl) return `📎 ${m.fileName || "File"}`;
  if (m.text) return m.text.length > 140 ? `${m.text.slice(0, 140)}…` : m.text;
  return "Message";
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Icon className="size-7 text-[color:var(--text-muted)]" />
      </div>
      <p className="text-sm font-medium text-[color:var(--text-primary)]">{title}</p>
            <p className="max-w-xs text-xs text-[color:var(--text-muted)]">{desc}</p>
    </div>
  );
}

function LibraryItem({ item, isFile, kind, onDelete }) {
  const { onlineUsers } = useAuthStore();
  const preview = messagePreview(item);
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const avatar = item.partnerProfilePic || "/avatar.png";

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(item._id, kind);
  };

  if (isFile) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer transition-colors hover:bg-white/10"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/20 text-[color:var(--accent-3)]">
          <FileTextIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
            {item.fileName || "File"}
          </p>
          <p className="truncate text-xs text-[color:var(--text-muted)]">
            {formatFileSize(item.fileSize)}{" "}
            {item.fileType ? `• ${item.fileType}` : ""} • {date}
          </p>
          <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]/70">
            From {item.partnerName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              useChatStore.getState().downloadMessageFile(item._id, item.fileName);
            }}
            className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            title="Download file"
            aria-label={`Download ${item.fileName || "file"}`}
          >
            <DownloadIcon className="size-4" />
          </button>
          <SectionActionMenu
            ariaLabel={`Actions for ${item.fileName || "file"}`}
            actions={[
              {
                key: "delete",
                label: "Delete",
                icon: Trash2Icon,
                variant: "danger",
                onClick: handleDelete,
              },
            ]}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer transition-colors hover:bg-white/10"
    >
      <div className="relative shrink-0">
        <img
          src={avatar}
          alt={item.partnerName}
          className="size-10 rounded-full object-cover"
          loading="lazy"
        />
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--panel)] ${
            onlineUsers.includes(String(item.partnerId))
              ? "bg-emerald-400"
              : "bg-slate-500"
          }`}
          title={onlineUsers.includes(String(item.partnerId)) ? "Online" : "Offline"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
          {item.partnerName}
        </p>
        <p className="truncate text-xs text-[color:var(--text-muted)]">
          {preview}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[10px] text-[color:var(--text-muted)]/70">{date}</span>
        <SectionActionMenu
          ariaLabel={`Actions for ${item.partnerName}`}
          actions={[
            {
              key: "delete",
              label: kind === "pinned" ? "Unpin" : "Remove from favorites",
              icon: Trash2Icon,
              variant: "danger",
              onClick: handleDelete,
            },
          ]}
        />
      </div>
    </motion.div>
  );
}

function QuickViewPanel({
  isOpen,
  section,
  onClose,
  onOpenConversation,
  onOpenAIAssistant,
  onCreateGroup,
}) {
  const { authUser } = useAuthStore();
  const {
    getLibrary,
    library,
    isLibraryLoading,
    libraryError,
    getCallHistory,
    callHistory,
    isCallHistoryLoading,
    callHistoryError,
    getAiHistory,
    aiHistory,
    isAiHistoryLoading,
    aiHistoryError,
    deleteLibraryItem,
    clearLibrary,
    deleteCallHistory,
    clearCallHistory,
    deleteAiHistoryItem,
    clearAiHistory,
  } = useChatStore();
  const [loadedKind, setLoadedKind] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const cfg = section ? SECTIONS[section] : null;

  // Fetch the library for data-backed sections when the panel opens or the
  // section changes. Fetch once per kind; the refresh button re-syncs.
  useEffect(() => {
    if (!isOpen) return;
    // Calls: fetch fresh every time the section is opened.
    if (section === "calls") {
      getCallHistory();
      return;
    }
    // AI History: fetch fresh every time the section is opened.
    if (section === "ai-history") {
      getAiHistory();
      return;
    }
    if (!cfg?.kind) return;
    if (loadedKind === cfg.kind) return;
    setLoadedKind(cfg.kind);
    getLibrary(cfg.kind);
  }, [isOpen, section, cfg, loadedKind, getLibrary, getCallHistory, getAiHistory]);

  const handleOpen = (item) => {
    if (!item?.partnerId) return;
    onOpenConversation({
      _id: item.partnerId,
      fullName: item.partnerName,
      profilePic: item.partnerProfilePic,
    });
  };

  const handleRefresh = () => {
    if (section === "calls") {
      getCallHistory();
      return;
    }
    if (section === "ai-history") {
      getAiHistory();
      return;
    }
    if (cfg?.kind) {
      setLoadedKind(null);
      getLibrary(cfg.kind);
    }
  };

  // ── Delete / Clear handlers ────────────────────────────────────────────────
  const handleDeleteLibraryItem = (messageId, kind) => {
    deleteLibraryItem(messageId, kind);
  };

  const handleDeleteCall = (callId) => {
    deleteCallHistory(callId);
  };

  const handleDeleteAiItem = (historyId) => {
    deleteAiHistoryItem(historyId);
  };

  const handleClearSection = async () => {
    let ok = false;
    if (section === "calls") {
      ok = await clearCallHistory();
    } else if (section === "ai-history") {
      ok = await clearAiHistory();
    } else if (cfg?.kind) {
      ok = await clearLibrary(cfg.kind);
    }
    if (ok) setClearModalOpen(false);
  };

  const showClearAll =
    section === "calls" ||
    section === "ai-history" ||
    !!cfg?.kind;

  const renderBody = () => {
    // ── Calls — real persisted call history (GET /api/calls) ──
    if (section === "calls") {
      const history = callHistory || [];
      if (isCallHistoryLoading && history.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2Icon className="size-5 animate-spin text-[color:var(--accent-3)]" />
            <p className="text-xs text-[color:var(--text-muted)]">Loading your call history…</p>
            {/* Premium skeleton shimmer lines */}
            <div className="w-full max-w-[220px] space-y-1.5 pt-2">
              {[280, 240, 200].map((w, idx) => (
                <div
                  key={idx}
                  className="h-3 animate-pulse rounded bg-white/5"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
          </div>
        );
      }
      if (callHistoryError && history.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-red-400">Couldn't load your call history.</p>
            <p className="max-w-xs text-center text-[10px] text-[color:var(--text-muted)]">
              {callHistoryError}
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRefresh}
              className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[color:var(--text-primary)] hover:bg-white/10"
            >
              Retry
            </motion.button>
          </div>
        );
      }
      if (history.length === 0) {
        return (
          <EmptyState
            icon={PhoneIcon}
            title="No call history yet"
            desc="Your call history will appear here once you make or receive a call. Start a call from any chat to begin your history."
          />
        );
      }
      return (
        <div className="h-full overflow-y-auto p-4">
          <div className="space-y-2">
            {history.map((c, i) => {
              const outgoing = c.direction === "outgoing";
              const DirIcon = outgoing ? ArrowUpRightIcon : ArrowDownLeftIcon;
              const statusLabel = CALL_STATUS_LABEL[c.status] || c.status;
              const missed = c.status === "missed";
              const declined = c.status === "rejected";
              const subtitle = [
                outgoing ? "Outgoing" : "Incoming",
                c.callType === "video" ? "Video" : "Voice",
                c.status === "completed" ? formatDuration(c.duration) : statusLabel,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <motion.div
                  key={c._id || i}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                >
                  <div
                    className="flex cursor-pointer items-center gap-3"
                    onClick={() =>
                      onOpenConversation({
                        _id: c.peerId,
                        fullName: c.peer?.fullName,
                        profilePic: c.peer?.profilePic,
                      })
                    }
                  >
                    <div className="relative shrink-0">
                      <img
                        src={c.peer?.profilePic || "/avatar.png"}
                        alt={c.peer?.fullName || "Contact"}
                        className="size-10 rounded-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                        {c.peer?.fullName || "Unknown"}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          missed || declined ? "text-rose-400" : "text-[color:var(--text-muted)]"
                        }`}
                      >
                        <DirIcon
                          className={`mr-1 inline size-3 ${
                            missed || declined ? "text-rose-400" : "text-[color:var(--accent-3)]"
                          }`}
                        />
                        {subtitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-[color:var(--text-muted)]/70">
                      {c.callType === "video" ? (
                      <VideoIcon className="inline size-3 text-[color:var(--accent-3)]" />
                    ) : (
                      <PhoneIcon className="inline size-3 text-[color:var(--accent-3)]" />
                    )}{" "}
                      {formatCallDate(c.startedAt || c.createdAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <SectionActionMenu
                      ariaLabel={`Actions for call with ${c.peer?.fullName || "contact"}`}
                      actions={[
                        {
                          key: "delete",
                          label: "Delete",
                          icon: Trash2Icon,
                          variant: "danger",
                          onClick: () => handleDeleteCall(c._id),
                        },
                      ]}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    }

        // ── Groups (real, wired UI) ──
    if (section === "groups") {
      return (
        <div className="h-full overflow-y-auto p-4 pb-6">
          <GroupsPanel onCreate={onCreateGroup} />
        </div>
      );
    }

    // ── AI History (persisted via GET /api/ai/history) ──
    if (section === "ai-history") {
      const history = aiHistory || [];
      if (isAiHistoryLoading && history.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2Icon className="size-5 animate-spin text-[color:var(--accent-3)]" />
            <p className="text-xs text-[color:var(--text-muted)]">Loading your AI history…</p>
            <div className="w-full max-w-[220px] space-y-1.5 pt-2">
              {[280, 240, 200].map((w, idx) => (
                <div
                  key={idx}
                  className="h-3 animate-pulse rounded bg-white/5"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
          </div>
        );
      }
      if (aiHistoryError && history.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-red-400">Couldn't load your AI history.</p>
            <p className="max-w-xs text-center text-[10px] text-[color:var(--text-muted)]">
              {aiHistoryError}
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRefresh}
              className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[color:var(--text-primary)] hover:bg-white/10"
            >
              Retry
            </motion.button>
          </div>
        );
      }
      if (history.length === 0) {
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <HistoryIcon className="size-7 text-[color:var(--text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[color:var(--text-primary)]">No AI history yet</p>
            <p className="max-w-xs text-center text-xs text-[color:var(--text-muted)]">
              Your AI assistant interactions will appear here. Use Grammar Fix, Translate,
              Reply Suggestion, Smart Reply, or Meeting Notes to build your history.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onClose();
                onOpenAIAssistant?.();
              }}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent-3)]/30 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--glow)] transition-transform"
            >
              <BotIcon className="size-4" />
              Open AI Assistant
            </motion.button>
          </div>
        );
      }
      return (
        <div className="h-full overflow-y-auto p-4">
          <div className="space-y-2">
            {history.map((item, i) => {
              const label = AI_FEATURE_LABELS[item.feature] || item.feature;
              const preview = typeof item.input === "string" ? item.input.slice(0, 120) : String(item.input || "").slice(0, 120);
              const resultPreview = typeof item.result === "string" ? item.result.slice(0, 160) : String(item.result || "").slice(0, 160);
              return (
                <motion.div
                  key={item._id || i}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/20 text-[color:var(--accent-3)]">
                    <SparklesIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[color:var(--text-primary)]">{label}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[10px] text-[color:var(--text-muted)]/70">
                          {formatAiHistoryDate(item.createdAt)}
                        </span>
                        <SectionActionMenu
                          ariaLabel={`Actions for ${label}`}
                          actions={[
                            {
                              key: "delete",
                              label: "Delete",
                              icon: Trash2Icon,
                              variant: "danger",
                              onClick: () => handleDeleteAiItem(item._id),
                            },
                          ]}
                        />
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted)]">
                      {preview || "…"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--text-primary)]/80">
                      {resultPreview || "…"}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Library-backed: Pinned / Favorites / Files ──
    if (!cfg?.kind) return null;
    const kind = cfg.kind;
    const data = library[kind] || [];
    const hasData = data.length > 0;

    if (isLibraryLoading && !hasData) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <Loader2Icon className="size-6 animate-spin text-[color:var(--accent-3)]" />
          <p className="text-xs text-[color:var(--text-muted)]">
            Loading your {cfg.label.toLowerCase()}…
          </p>
        </div>
      );
    }

    if (libraryError && !hasData) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-red-400">
            Couldn't load {cfg.label.toLowerCase()}.
          </p>
          <p className="max-w-xs text-center text-[10px] text-[color:var(--text-muted)]">
            {libraryError}
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleRefresh}
            className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[color:var(--text-primary)] hover:bg-white/10"
          >
            Retry
          </motion.button>
        </div>
      );
    }

    if (!hasData) {
      if (cfg.empty) return <EmptyState {...cfg.empty} />;
      return (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.label.toLowerCase()}`}
          desc="Nothing to show yet."
        />
      );
    }

    const isFileView = kind === "files";
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="space-y-2">
          {data.map((item, i) => (
            <motion.div
              key={item._id || i}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleOpen(item)}
            >
              <LibraryItem
                item={item}
                isFile={isFileView}
                kind={kind}
                onDelete={handleDeleteLibraryItem}
              />
            </motion.div>
          ))}
        </div>
            </div>
    );
  };

  const headerTitle = cfg?.label || "Quick View";
  const showRefresh = !!cfg?.kind || section === "calls" || section === "ai-history";
  const isRefreshing = section === "calls" ? isCallHistoryLoading : section === "ai-history" ? isAiHistoryLoading : isLibraryLoading;

  const clearAllLabel =
    section === "calls"
      ? "Clear call history"
      : section === "ai-history"
      ? "Clear AI history"
      : cfg?.kind === "pinned"
      ? "Clear pinned"
      : cfg?.kind === "starred"
      ? "Clear favorites"
      : cfg?.kind === "files"
      ? "Clear files"
      : "Clear all";

  const clearAllDescription =
    section === "calls"
      ? "This will remove all entries from your call history. This cannot be undone."
      : section === "ai-history"
      ? "This will remove all entries from your AI history. This cannot be undone."
      : cfg?.kind === "pinned"
      ? "This will unpin all messages. This cannot be undone."
      : cfg?.kind === "starred"
      ? "This will remove all messages from your favorites. This cannot be undone."
      : cfg?.kind === "files"
      ? "This will remove all files from your library. This cannot be undone."
      : "This will remove all items from this section. This cannot be undone.";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
          />

          {/* Slide-over aside */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-[80] flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl sm:inset-y-0"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <motion.div
                  key={section}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5"
                >
                  {cfg ? (
                    <cfg.icon
                      className={`size-4 ${
                        cfg.iconColor || "text-[color:var(--text-muted)]"
                      }`}
                    />
                  ) : (
                    <HistoryIcon className="size-4 text-[color:var(--text-muted)]" />
                  )}
                </motion.div>
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {headerTitle}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                {showRefresh && (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Refresh"
                    aria-label={`Refresh ${headerTitle}`}
                    className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)] disabled:opacity-60"
                  >
                    <RefreshCwIcon
                      className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                  </motion.button>
                )}
                {showClearAll && (
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setClearModalOpen(true)}
                    title="Clear all"
                    aria-label={`Clear all ${headerTitle}`}
                    className="flex size-8 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    <Trash2Icon className="size-3.5" />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  title="Close"
                  aria-label="Close"
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  <XIcon className="size-4" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-hidden">{renderBody()}</div>

            {/* Authenticated user hint */}
            <div className="shrink-0 border-t border-white/10 px-4 py-2 text-[10px] text-[color:var(--text-muted)]">
              Logged in as {authUser?.fullName || "…"}
            </div>
          </motion.aside>

          {/* Clear-all confirmation modal */}
          <ClearSectionModal
            isOpen={clearModalOpen}
            onClose={() => setClearModalOpen(false)}
            onConfirm={handleClearSection}
            title={clearAllLabel}
            description={clearAllDescription}
            confirmLabel="Clear All"
          />
        </>
      )}
    </AnimatePresence>
  );
}

export default QuickViewPanel;


