import { motion, AnimatePresence } from "framer-motion";
import { BellIcon, AtSignIcon, ReplyIcon, CheckIcon, Volume2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { createPortal } from "react-dom";

/**
 * Notification Center — bell icon in sidebar.
 * Derives real notifications from the current conversation's messages:
 * - Mentions (@you) from incoming messages
 * - Replies to your messages (via replyTo)
 * - AI suggestions (when relevant)
 * Clicking a notification marks it read.
 */
function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, selectedUser, selectedGroup, notificationsEnabled, requestNotificationPermission, testNotification } = useChatStore();
  const { authUser } = useAuthStore();
  
  // Track which conversations have been "read" (opened) - key format: "user-{userId}" or "group-{groupId}"
  const [readConversations, setReadConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vyntra-notif-read-conversations")) || [];
    } catch {
      return [];
    }
  });

  const isSupported = typeof window !== "undefined" && "Notification" in window;

  // Track the currently open conversation ID
  const openChatId = selectedGroup?._id ? `group-${selectedGroup._id}` : selectedUser?._id ? `user-${selectedUser._id}` : null;

  // Auto-mark the currently open conversation as read when it changes
  useEffect(() => {
    if (!openChatId) return;
    if (readConversations.includes(openChatId)) return;

    const updated = [...readConversations, openChatId];
    setReadConversations(updated);
    localStorage.setItem("vyntra-notif-read-conversations", JSON.stringify(updated));
  }, [openChatId, readConversations]);

  // Also keep legacy readIds for backward compat (individual notification clicks)
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vyntra-notif-read")) || [];
    } catch {
      return [];
    }
  });

  // Build real notifications from the current conversation's messages.
  const items = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const list = [];
    const incoming = messages.filter((m) => m.senderId !== authUser?._id);

    // Determine if the current conversation has been "read" (opened)
    const isConversationRead = openChatId ? readConversations.includes(openChatId) : false;

    // Replies to my messages (incoming messages that quote my message)
    const replies = incoming.filter((m) => m.replyTo?.senderId === authUser?._id);
    if (replies.length > 0) {
      const last = replies[replies.length - 1];
      const notifId = `reply-${last._id}`;
      list.push({
        id: notifId,
        type: "replies",
        icon: ReplyIcon,
        title: "New reply",
        desc: `${selectedUser?.fullName || "Someone"}: ${last.text?.slice(0, 40) || "replied to you"}`,
        time: timeAgo(last.createdAt),
        read: isConversationRead || readIds.includes(notifId),
        accent: "text-emerald-400",
      });
    }

    // Mentions (@me) in incoming messages
    const mentions = incoming.filter((m) => m.text?.includes(`@${authUser?.fullName?.split(" ")[0]}`) || m.text?.includes("@you"));
    if (mentions.length > 0) {
      const last = mentions[mentions.length - 1];
      const notifId = `mention-${last._id}`;
      list.push({
        id: notifId,
        type: "mentions",
        icon: AtSignIcon,
        title: "Mentioned you",
        desc: `${selectedUser?.fullName || "Someone"}: ${last.text?.slice(0, 40)}`,
        time: timeAgo(last.createdAt),
        read: isConversationRead || readIds.includes(notifId),
        accent: "text-[color:var(--accent-3)]",
      });
    }

    // New messages (general)
    if (incoming.length > 0) {
      const last = incoming[incoming.length - 1];
      const notifId = `msg-${last._id}`;
      list.push({
        id: notifId,
        type: "messages",
        icon: BellIcon,
        title: "New message",
        desc: `${selectedUser?.fullName || "Someone"}: ${last.text?.slice(0, 40) || (last.image ? "📷 Photo" : "")}`,
        time: timeAgo(last.createdAt),
        read: isConversationRead || readIds.includes(notifId),
        accent: "text-[color:var(--accent)]",
      });
    }

    return list;
  }, [messages, authUser, selectedUser, readIds, openChatId, readConversations]);

  const unread = items.filter((n) => !n.read).length;

  const persistRead = (ids) => {
    setReadIds(ids);
    localStorage.setItem("vyntra-notif-read", JSON.stringify(ids));
  };

  const persistConversationRead = (conversationIds) => {
    setReadConversations(conversationIds);
    localStorage.setItem("vyntra-notif-read-conversations", JSON.stringify(conversationIds));
  };

  const markAllRead = () => {
    persistRead(items.map((n) => n.id));
    if (openChatId && !readConversations.includes(openChatId)) {
      persistConversationRead([...readConversations, openChatId]);
    }
  };
  const markRead = (id) => {
    if (!readIds.includes(id)) persistRead([...readIds, id]);
    // Also mark the current conversation as read when clicking a notification
    if (openChatId && !readConversations.includes(openChatId)) {
      persistConversationRead([...readConversations, openChatId]);
    }
  };

  const bellRef = useRef(null);
  const popupRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  // Calculate the popup position from the bell button and clamp it inside the
  // viewport so it is NEVER clipped near the sidebar boundary or right edge.
  const recalcPosition = useCallback(() => {
    const bell = bellRef.current;
    const popup = popupRef.current;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    const POPUP_WIDTH = 320;
    const POPUP_MAX_HEIGHT = 440;
    const GAP = 8;
    const PAD = 8;

    const height = popup ? popup.offsetHeight || POPUP_MAX_HEIGHT : POPUP_MAX_HEIGHT;

    // Anchor the popup to the bell's left edge; if it would overflow the right
    // edge, pull it back so it stays fully on screen.
    let left = rect.left;
    if (left + POPUP_WIDTH > window.innerWidth - PAD) {
      left = window.innerWidth - POPUP_WIDTH - PAD;
    }
    left = Math.max(PAD, left);

    // Prefer opening BELOW the bell; if it overflows the bottom, open above it.
    let top = rect.bottom + GAP;
    if (top + height > window.innerHeight - PAD) {
      top = rect.top - height - GAP;
    }
    top = Math.max(PAD, top);

    setMenuPos({ top, left, width: POPUP_WIDTH });
  }, []);

  const openMenu = () => {
    setIsOpen((o) => {
      if (!o) recalcPosition();
      return !o;
    });
  };

  // Keep the popup correctly positioned while it is open (resize/scroll).
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => recalcPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, recalcPosition]);

  return (
    <div className="relative">
      <motion.button
        ref={bellRef}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        onClick={openMenu}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[color:var(--panel-strong)]/70 text-[color:var(--text-muted)] backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)] hover:shadow-[0_4px_16px_var(--glow)]"
        title="Notifications"
      >
        <BellIcon className="size-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-400 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.8)]"
            title={`${unread} unread notification${unread === 1 ? "" : "s"}`}
          >
            {unread}
          </span>
        )}
      </motion.button>

      {isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[80]"
            />
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="fixed z-[120] overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
              style={{
                top: menuPos?.top ?? 0,
                left: menuPos?.left ?? 0,
                width: menuPos?.width ?? 320,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Notifications</h3>
                <div className="flex items-center gap-2">
                  {isSupported && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notificationsEnabled) {
                          testNotification();
                        } else {
                          requestNotificationPermission();
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--accent-3)]"
                      title={notificationsEnabled ? "Test notification" : "Enable browser notifications"}
                    >
                      <Volume2Icon className="size-3" />
                      {notificationsEnabled ? "Test" : "Enable"}
                    </button>
                  )}
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--accent-3)] transition hover:underline"
                  >
                    <CheckIcon className="size-3" />
                    Mark all read
                  </button>
                </div>
              </div>

              <div className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <BellIcon className="size-8 text-[color:var(--text-muted)]/40" />
                    <p className="text-sm text-[color:var(--text-muted)]">No notifications yet</p>
                    <p className="text-xs text-[color:var(--text-muted)]/70">Open a conversation to see mentions, replies & messages.</p>
                    {isSupported && Notification.permission === "denied" && (
                      <p className="mt-2 text-[10px] text-rose-400/80">Browser notifications are blocked. Enable them in your browser settings to receive alerts.</p>
                    )}
                  </div>
                ) : (
                  items.map((n) => (
                    <motion.button
                      key={n.id}
                      whileHover={{ x: 3 }}
                      onClick={() => markRead(n.id)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        n.read ? "opacity-60" : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 ${n.accent}`}>
                        <n.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-[color:var(--text-primary)]">{n.title}</span>
                          <span className="shrink-0 text-[10px] text-[color:var(--text-muted)]">{n.time}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[color:var(--text-muted)]">{n.desc}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[color:var(--accent-3)]" />}
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default NotificationCenter;
