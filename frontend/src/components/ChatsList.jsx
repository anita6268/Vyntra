import { motion } from "framer-motion";
import { MessageCircleMore, SearchIcon, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";
import { formatLastSeen, formatTimeLabel } from "../lib/formatLastSeen";
import UserAvatar from "./UserAvatar";

function ChatsList({ filter = "", selectedIndex: externalIndex, onSelect, onKeyDown }) {
  const {
    getMyChatPartners,
    chats,
    typingUsers,
    isUsersLoading,
    setSelectedUser,
    selectedUser,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  const [internalIndex, setInternalIndex] = useState(-1);
  const selectedIndex = externalIndex ?? internalIndex;
  const setSelectedIndex = onSelect ? setInternalIndex : () => {};

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  const sorted = useMemo(() => {
    const onlineSet = new Set(onlineUsers.map((id) => String(id)));
    const list = Array.isArray(chats) ? chats : [];
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const aOnline = onlineSet.has(String(a._id));
      const bOnline = onlineSet.has(String(b._id));
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });
  }, [chats, onlineUsers]);

  if (isUsersLoading && !Array.isArray(chats)) return <UsersLoadingSkeleton />;
  if (!Array.isArray(chats) || chats.length === 0) return <NoChatsFound />;

  const filtered = filter.trim()
    ? sorted.filter((chat) =>
        chat.fullName?.toLowerCase().includes(filter.trim().toLowerCase()) ||
        chat.phone?.toLowerCase().includes(filter.trim().toLowerCase())
      )
    : sorted;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
        <p className="text-sm text-[color:var(--text-muted)]">No chats match "{filter}"</p>
      </div>
    );
  }

  const handleKey = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < filtered.length) {
      e.preventDefault();
      const chat = filtered[selectedIndex];
      if (onSelect) onSelect(chat);
      else setSelectedUser(chat);
    }
  };

  const previewOf = (chat) => {
    const last = chat.lastMessage;
    if (!last) return "No messages yet";
    const fromMe = authUser && last.senderId === authUser._id;
    const prefix = fromMe ? "You: " : "";
    if (last.text) return `${prefix}${last.text}`;
    if (last.image) return `${prefix}Photo`;
    if (last.audio) return `${prefix}Voice message`;
    if (last.fileUrl) return `${prefix}${last.fileName || "File"}`;
    return `${prefix}Message`;
  };

  return (
    <div onKeyDown={handleKey} tabIndex={0} role="listbox" aria-label="Chats">
      {filtered.map((chat, idx) => {
        const chatId = String(chat._id);
        const isOnline = onlineUsers.includes(String(chat._id)) && chat.showOnline !== false;
        const isSelected = selectedUser?._id === chat._id;
        const unreadCount = chat.unreadCount || 0;
        const last = chat.lastMessage;
        const isMine = last && authUser && last.senderId === authUser._id;
        const isTyping = Boolean(typingUsers?.[chatId]);
        const lastSeenLabel = isOnline ? null : formatLastSeen(chat.lastSeen);
        const isFocused = selectedIndex === idx;

        return (
          <motion.div
            key={chatId}
            layout
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`cursor-pointer rounded-2xl p-3 backdrop-blur-xl transition-all duration-300 ${
              isSelected
                ? "selected-contact"
                : isFocused
                  ? "border border-[color:var(--accent-3)]/30 bg-white/5"
                  : "border border-white/[0.04] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
            }`}
            onClick={() => {
              if (onSelect) onSelect(chat);
              else setSelectedUser(chat);
            }}
            role="option"
            aria-selected={isSelected}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                src={chat.profilePic}
                name={chat.fullName}
                size={44}
                online={isOnline}
                className="size-11"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-bold text-[color:var(--text-primary)]">
                    {chat.fullName}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-[10px] font-bold text-white shadow-[0_0_8px_var(--glow)]"
                        title={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                    {last && !isTyping && (
                      <span className="shrink-0 text-[10px] text-[color:var(--text-muted)]/70">
                        {formatTimeLabel(last.createdAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                  {isTyping ? (
                    <span className="font-medium text-emerald-400">typing...</span>
                  ) : isOnline ? (
                    <>
                      <span className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                      <span className="text-emerald-400">Online</span>
                      {last && <span className="mx-1 h-3 w-px bg-white/10" />}
                    </>
                  ) : (
                    <>
                      <span className="text-[color:var(--text-muted)]/70">
                        {lastSeenLabel || "Offline"}
                      </span>
                      {last && <span className="mx-1 h-3 w-px bg-white/10" />}
                    </>
                  )}

                  {!isTyping && last && (
                    <>
                      {isMine ? (
                        <CheckCheck className="size-3 shrink-0 text-[color:var(--accent-3)]" title="Seen" />
                      ) : (
                        <MessageCircleMore className="size-3 shrink-0" title="Message" />
                      )}
                      <span className="min-w-0 truncate">{previewOf(chat)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default ChatsList;